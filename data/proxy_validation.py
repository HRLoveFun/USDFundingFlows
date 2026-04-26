#!/usr/bin/env python3
"""
proxy_validation.py — S2.2 empirical validation harness.

For each NODE in `js/v2/proxy_registry.js` whose primary is non-null and is
backed by a public-source series available in `data/json/`, computes:
  - month-end-aligned `(anchor, candidate)` Pearson correlation
  - rolling 36-month correlation (last value → `corr_36m`)
  - R005 short-history fallback when overlapping months < 36

Outputs:
  data/json/proxy_charts/<node_id>.json   — per-node monthly pairs + stats
  data/json/proxy_empirical.json          — flat summary (consumed by S2.3)

Reads:
  data/json/raw_observations.json    (FRED, native frequency, 43 series)
  data/json/raw_observations_v2.json (FRED extra, 9 series)
  data/json/fed_balance_sheet.json   (FRED H.4.1, 8 series)
  data/json/nyfed_operations.json    (5 endpoints × {metric: {date: value}})
  data/json/treasury_flows.json      (TGA daily, auctions by term)
  data/json/pressure_indicators.json (Derived spreads)
  data/proxy_validation_anchors.json (anchor/candidate pairing per node)
  js/v2/proxy_registry.js            (node coverage; classifies pending-S2.4)

Per D-001:
  - Permanent not_found: foreign_insurers, corporates_offshore — skipped.
  - pending-S2.4 (External / proxy_status='external' or 'partial'): emit
    placeholder record `{corr_36m: null, note: "pending-S2.4: ..."}`.

Per D-002:
  - empirical.window is fixed "36M_monthly".
  - chart_path = data/json/proxy_charts/<node_id>.json (JSON, not PNG).

Idempotent: re-running overwrites cleanly.
"""
from __future__ import annotations

import json
import math
import sys
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from _jsparse import parse_object_keys  # noqa: E402

DATA_JSON = REPO_ROOT / "data" / "json"
DATA_RAW = REPO_ROOT / "data" / "raw"
CHARTS_DIR = DATA_JSON / "proxy_charts"
ANCHOR_FILE = REPO_ROOT / "data" / "proxy_validation_anchors.json"
REGISTRY_FILE = REPO_ROOT / "js" / "v2" / "proxy_registry.js"
SUMMARY_FILE = DATA_JSON / "proxy_empirical.json"

PERMANENT_NOT_FOUND = {"foreign_insurers", "corporates_offshore"}
ROLLING_WINDOW = 36  # months — spec §Constraints


# ──────────────────────────────────────────────────────────────────────
# Series loaders
# ──────────────────────────────────────────────────────────────────────
def _load_json(p: Path) -> dict:
    with p.open(encoding="utf-8") as f:
        return json.load(f)


class SeriesStore:
    """Resolves (source, series, metric?) → {date_str: float}."""

    def __init__(self) -> None:
        self.fred: dict[str, dict[str, float]] = {}
        for fname in ("raw_observations.json", "raw_observations_v2.json", "fed_balance_sheet.json"):
            data = _load_json(DATA_JSON / fname)
            for sid, obs in data.items():
                # later files override earlier — H.4.1 is authoritative for shared keys
                self.fred[sid] = obs

        self.nyfed = _load_json(DATA_JSON / "nyfed_operations.json")
        self.treasury = _load_json(DATA_JSON / "treasury_flows.json")
        self.derived = _load_json(DATA_JSON / "pressure_indicators.json")

        # S2.4 — whitelist sources land their raw JSON under data/raw/<src>/.
        # Each file is `{alias, observations: {YYYY-MM-DD: value}}` (OFR / NYFed-PD)
        # or `{alias, rows: [...]}` (CFTC TFF Socrata). Loaded lazily-and-eagerly:
        # eager = single small dir scan at startup, no network.
        self.ofr: dict[str, dict[str, float]] = self._load_alias_dir(
            DATA_RAW / "ofr", payload_key="observations"
        )
        self.nyfed_pd: dict[str, dict[str, float]] = self._load_alias_dir(
            DATA_RAW / "nyfed_pd", payload_key="observations"
        )
        # CFTC: collapse `rows` to {date: net_position} where net = long - short.
        self.cftc: dict[str, dict[str, float]] = self._load_cftc_dir(DATA_RAW / "cftc")

    @staticmethod
    def _load_alias_dir(d: Path, payload_key: str) -> dict[str, dict[str, float]]:
        out: dict[str, dict[str, float]] = {}
        if not d.is_dir():
            return out
        for f in d.glob("*.json"):
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            obs = doc.get(payload_key, {})
            if isinstance(obs, dict):
                out[doc.get("alias", f.stem)] = obs
        return out

    @staticmethod
    def _load_cftc_dir(d: Path) -> dict[str, dict[str, float]]:
        """Collapse Socrata TFF rows to a single per-date scalar.

        Default scalar = `lev_money_positions_long - lev_money_positions_short`
        (net long; negative => leveraged-money net short, i.e. basis trade scale).
        Per-row date strings carry an ISO8601 'T00:00:00.000' suffix; we keep
        only the YYYY-MM-DD prefix for monthly resampling downstream.
        """
        out: dict[str, dict[str, float]] = {}
        if not d.is_dir():
            return out
        for f in d.glob("*.json"):
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                continue
            obs: dict[str, float] = {}
            for r in doc.get("rows", []):
                ds = r.get("report_date_as_yyyy_mm_dd", "")
                if not isinstance(ds, str) or len(ds) < 10:
                    continue
                try:
                    long_n = float(r.get("lev_money_positions_long") or 0)
                    short_n = float(r.get("lev_money_positions_short") or 0)
                except (TypeError, ValueError):
                    continue
                obs[ds[:10]] = long_n - short_n
            out[doc.get("alias", f.stem)] = obs
        return out

    def fetch(self, source: str, series: str, metric: str | None = None) -> dict[str, float]:
        if source == "FRED":
            return self.fred.get(series, {})
        if source == "NYFed":
            # Two NYFed back-stores share this enum value:
            #   (a) Markets API operations  → self.nyfed[endpoint][metric]
            #   (b) Primary Dealer Stats    → self.nyfed_pd[alias]  (S2.4)
            # Disambiguate by alias presence; PD aliases are unique strings so
            # a single lookup is safe.
            if series in self.nyfed_pd:
                return self.nyfed_pd[series]
            ep = self.nyfed.get(series, {})
            if metric is None:
                return {}
            v = ep.get(metric, {})
            return v if isinstance(v, dict) else {}
        if source == "Treasury":
            v = self.treasury.get(series)
            if isinstance(v, dict) and metric is None:
                return v  # tga_balance_usd_m is flat
            if isinstance(v, dict) and metric is not None:
                # auctions_btc_by_term is keyed by 'Bill|13-Week' style
                return v.get(metric, {})
            return {}
        if source == "Derived":
            return self.derived.get(series, {})
        if source == "OFR":
            return self.ofr.get(series, {})
        if source == "NYFed-PD":
            # Legacy alias retained for transition; identical to NYFed for PD aliases.
            return self.nyfed_pd.get(series, {})
        if source == "CFTC":
            return self.cftc.get(series, {})
        return {}


# ──────────────────────────────────────────────────────────────────────
# Monthly alignment + correlation (no pandas — keep dependency surface tight)
# ──────────────────────────────────────────────────────────────────────
def to_month_end_last_obs(obs: dict[str, float]) -> dict[str, float]:
    """Resample {YYYY-MM-DD: float} to {YYYY-MM: float} using last observation in month."""
    monthly: dict[str, tuple[str, float]] = {}
    for ds, v in obs.items():
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if math.isnan(f):
            continue
        ym = ds[:7]
        prev = monthly.get(ym)
        if prev is None or ds > prev[0]:
            monthly[ym] = (ds, f)
    return {ym: pair[1] for ym, pair in monthly.items()}


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = 0.0
    sx2 = 0.0
    sy2 = 0.0
    for x, y in zip(xs, ys):
        dx = x - mx
        dy = y - my
        num += dx * dy
        sx2 += dx * dx
        sy2 += dy * dy
    if sx2 == 0 or sy2 == 0:
        return None
    return num / math.sqrt(sx2 * sy2)


def rolling_corr(xs: list[float], ys: list[float], window: int) -> list[float | None]:
    out: list[float | None] = []
    for i in range(len(xs)):
        if i + 1 < window:
            out.append(None)
            continue
        out.append(pearson(xs[i + 1 - window : i + 1], ys[i + 1 - window : i + 1]))
    return out


# ──────────────────────────────────────────────────────────────────────
# Registry classification
# ──────────────────────────────────────────────────────────────────────
def classify_registry() -> dict[str, str]:
    """Returns {node_id: classification} where classification ∈ {live, pending, not_found}.

    Per D-002 schema (S2.3): a node is `pending` iff its `primary` is structurally
    `null` (and the node is not in PERMANENT_NOT_FOUND). Otherwise it is `live`.
    The legacy substring heuristic on `proxy_status: "external"` is kept as a
    defensive secondary signal during the S2.3→S2.4 transition.
    """
    src = REGISTRY_FILE.read_text(encoding="utf-8")
    entries = parse_object_keys(src, r"export\s+const\s+NODE_PROXIES\s*=\s*\{")
    out: dict[str, str] = {}
    for nid, raw in entries.items():
        if nid in PERMANENT_NOT_FOUND:
            out[nid] = "not_found"
            continue
        # Structural signal: top-level `primary: null` declares a not-yet-live node.
        # Use a lenient check that tolerates whitespace/newlines.
        import re as _re
        is_null_primary = bool(_re.search(r"primary\s*:\s*null\b", raw))
        legacy_external = (
            ('source: "External"' in raw)
            or ("'External'" in raw and "source:" in raw)
            or ('proxy_status: "external"' in raw)
            or ('proxy_status: "partial"' in raw)
        )
        out[nid] = "pending" if (is_null_primary or legacy_external) else "live"
    return out


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────
def main() -> int:
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)
    store = SeriesStore()
    anchors_doc = _load_json(ANCHOR_FILE)
    anchors: dict[str, dict] = anchors_doc["anchors"]
    classification = classify_registry()
    today = date.today().isoformat()

    summary: dict[str, dict] = {}

    for nid, klass in sorted(classification.items()):
        if klass == "not_found":
            # No empirical record per handoff rule.
            continue

        if klass == "pending":
            chart_path = f"data/json/proxy_charts/{nid}.json"
            summary[nid] = {
                "corr_36m": None,
                "chart_path": chart_path,
                "last_updated": today,
                "sample_months": 0,
                "note": "pending-S2.4: external whitelist source not yet implemented",
            }
            (CHARTS_DIR / f"{nid}.json").write_text(
                json.dumps(
                    {
                        "node_id": nid,
                        "status": "pending-S2.4",
                        "monthly_pairs": [],
                        "corr_36m": None,
                        "note": "pending-S2.4: external whitelist source not yet implemented",
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            continue

        # klass == "live"
        a = anchors.get(nid)
        if a is None:
            print(f"[warn] {nid}: live in registry but no anchor mapping — skip", file=sys.stderr)
            continue

        cand = a["candidate"]
        cand_obs = to_month_end_last_obs(
            store.fetch(cand["source"], cand["series"], cand.get("metric"))
        )
        if a["anchor"] == "self":
            anchor_obs = cand_obs
            self_anchored = True
            anch_id = f'{cand["source"]}:{cand["series"]}'
        else:
            an = a["anchor"]
            anchor_obs = to_month_end_last_obs(
                store.fetch(an["source"], an["series"], an.get("metric"))
            )
            self_anchored = False
            anch_id = f'{an["source"]}:{an["series"]}'
            if an.get("metric"):
                anch_id += f':{an["metric"]}'

        cand_id = f'{cand["source"]}:{cand["series"]}'
        if cand.get("metric"):
            cand_id += f':{cand["metric"]}'

        # join on month
        months = sorted(set(cand_obs) & set(anchor_obs))
        pairs = [(m, anchor_obs[m], cand_obs[m]) for m in months]

        if self_anchored:
            if len(pairs) == 0:
                # Series declared in registry but absent from data/json snapshots.
                # See R008 — flag and emit null corr; do NOT lie with 1.0.
                corr_36m = None
                corr_full = None
                note = (
                    f"data-missing (R008): candidate {cand_id} not in data/json snapshots; "
                    "S2.4 / pipeline backfill needed before empirical pass"
                )
                roll = []
            else:
                corr_36m = 1.0
                corr_full = 1.0
                note = "self-anchored: candidate IS the directly observed concept (no independent public benchmark exists)"
                roll = [1.0 if i + 1 >= ROLLING_WINDOW else None for i in range(len(pairs))]
        else:
            xs = [p[1] for p in pairs]  # anchor
            ys = [p[2] for p in pairs]  # candidate
            corr_full = pearson(xs, ys)
            roll = rolling_corr(xs, ys, ROLLING_WINDOW)
            if len(pairs) == 0:
                corr_36m = None
                note = (
                    f"data-missing (R008): candidate {cand_id} or anchor {anch_id} "
                    "not in data/json snapshots"
                )
            elif len(pairs) < ROLLING_WINDOW:
                corr_36m = None
                note = f"short-history fallback (R005): {len(pairs)}M overlapping sample"
            else:
                corr_36m = roll[-1]
                note = None

        chart_path = f"data/json/proxy_charts/{nid}.json"
        chart_doc = {
            "node_id": nid,
            "candidate": cand_id,
            "anchor": anch_id,
            "self_anchored": self_anchored,
            "anchor_rationale": a["anchor_rationale"],
            "window": "36M_monthly",
            "corr_36m": corr_36m,
            "corr_full_sample": corr_full,
            "sample_months": len(pairs),
            "start_date": pairs[0][0] if pairs else None,
            "end_date": pairs[-1][0] if pairs else None,
            "note": note,
            "monthly_pairs": [
                {"month": m, "anchor": float(av), "candidate": float(cv), "rolling_corr_36m": rc}
                for (m, av, cv), rc in zip(pairs, roll)
            ],
        }
        (CHARTS_DIR / f"{nid}.json").write_text(
            json.dumps(chart_doc, indent=2), encoding="utf-8"
        )

        summary[nid] = {
            "corr_36m": corr_36m,
            "corr_full_sample": corr_full,
            "chart_path": chart_path,
            "last_updated": today,
            "sample_months": len(pairs),
            "note": note,
        }

    SUMMARY_FILE.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Console report
    print("=" * 72)
    print("S2.2 — Proxy Empirical Validation")
    print("=" * 72)
    live = [n for n, k in classification.items() if k == "live"]
    pending = [n for n, k in classification.items() if k == "pending"]
    not_found = [n for n, k in classification.items() if k == "not_found"]
    print(f"  live anchored      : {len(live)}")
    print(f"  pending S2.4       : {len(pending)}")
    print(f"  permanent not_found: {len(not_found)} (skipped)")
    print()
    print(f"{'node_id':<30s} {'corr_36m':>10s} {'samples':>8s}  note")
    print("-" * 80)
    for nid in sorted(summary):
        rec = summary[nid]
        c = rec["corr_36m"]
        cstr = f"{c:>10.4f}" if isinstance(c, (int, float)) else f"{'null':>10s}"
        n = rec.get("sample_months", 0)
        note = (rec.get("note") or "")[:38]
        print(f"{nid:<30s} {cstr} {n:>8d}  {note}")
    print()
    print(f"summary → {SUMMARY_FILE.relative_to(REPO_ROOT)}")
    print(f"per-node charts → {CHARTS_DIR.relative_to(REPO_ROOT)}/<node_id>.json ({len(summary)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
