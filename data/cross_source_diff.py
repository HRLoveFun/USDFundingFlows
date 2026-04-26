#!/usr/bin/env python3
"""
cross_source_diff.py — S2.5 cross-source latest-observation diff scanner.

Reads:
  - js/v2/proxy_registry.js         (D-002 canonical registry, primary + alternates)
  - data/proxy_validation_anchors.json (S2.2 / S2.4 anchor map; cross-source rows)
  - existing snapshot files via SeriesStore (data.proxy_validation)

Writes:
  - data/json/cross_source_diff.json

Per-pair record:
  {
    node_id, kind ('anchor' | 'alternate'),
    candidate: {source, series, metric?, units, freq, latest_date, latest_value, stale},
    comparator: {... same shape ...},
    same_concept: bool,
    substitute: bool,
    units_normalized: bool,
    candidate_value_norm, comparator_value_norm,
    relative_diff_pct: float | null,
    violates_5pct_rule: bool,
    priority_source: 'primary' | 'alternate' | 'candidate' | 'anchor',
    diff_note_required: bool,
    cross_source_diff_note: str | null,
    skip_reason?: str
  }

The 5% rule (spec §AC#6 / D-005):
  applies only when (same_concept == True AND substitute == False AND
                     both sides have a numeric latest observation AND units are convertible).

Substitute pairs are exempt by design (D-005 Part 1) — currently only gov_mmf.

Stale thresholds (D-005 Part 2): D=7d / W=21d / M=60d / Q=180d / irregular=∞.

This script DOES NOT modify the registry. It is read-only on data; refresh
of underlying snapshots is the S4.1 pipeline's job.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

# Reuse the SeriesStore from S2.2 harness — single source of truth for snapshot loading.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))
from data.proxy_validation import SeriesStore  # noqa: E402
from _jsparse import parse_object_keys  # noqa: E402

REGISTRY_JS = ROOT / "js" / "v2" / "proxy_registry.js"
ANCHORS_JSON = ROOT / "data" / "proxy_validation_anchors.json"
OUT_JSON = ROOT / "data" / "json" / "cross_source_diff.json"

# ──────────────────────────────────────────────────────────────────────
# D-005 Part 2 — stale thresholds (days)
# ──────────────────────────────────────────────────────────────────────
STALE_DAYS = {"D": 7, "W": 21, "M": 60, "Q": 180, "irregular": 10**6}

# ──────────────────────────────────────────────────────────────────────
# D-005 Part 1 — substitute-pair exemption list
# Each entry: (node_id, kind, candidate_series, comparator_series)
# These pairs are by-design negatively or non-linearly related; the 5%
# rule does not apply. They still appear in the output JSON so the front-end
# can surface the substitution rationale, but `violates_5pct_rule` is forced
# to False and `substitute: True`.
# ──────────────────────────────────────────────────────────────────────
SUBSTITUTE_PAIRS: set[tuple[str, str, str]] = {
    ("gov_mmf", "ofr_mmf_treasury_repo_total", "RRPONTTLD"),
}

# ──────────────────────────────────────────────────────────────────────
# Same-concept whitelist — pairs where the 5% rule MUST run (units convert).
# (node_id, candidate_series, comparator_series)
# Anything not in this set is informational-only (same_concept=False),
# regardless of whether it is in Set A or Set B.
# ──────────────────────────────────────────────────────────────────────
SAME_CONCEPT_PAIRS: set[tuple[str, str, str]] = {
    ("bs_tga", "tga_balance_usd_m", "WTREGEN"),
    ("us_treasury", "tga_balance_usd_m", "WTREGEN"),
    ("bs_rrp", "RRPONTTLD", "rrp_ops"),
    ("bs_rrp_omo", "RRPONTTLD", "rrp_ops"),
}

# Unit conversion table (target unit = "Mil. USD" for monetary diffs)
UNIT_TO_MIL_USD = {"Mil. USD": 1.0, "Bil. USD": 1000.0, "USD": 1.0e-6}

# Per-(source, series) unit override — applied BEFORE UNIT_TO_MIL_USD lookup.
# Some upstream sources publish raw USD even though the registry annotates
# them as Mil. USD (registry-side fix is out of scope for S2.5 read-only).
# This is logged in D-005 as a follow-up registry metadata correction for S4.1.
UNIT_OVERRIDES: dict[tuple[str, str], str] = {
    ("NYFed", "rrp_ops"): "USD",
    ("NYFed", "srf_ops"): "USD",
}

# ──────────────────────────────────────────────────────────────────────
# Curated human notes for every >5% violation (plan §S2.5 acceptance).
# Keyed by (node_id, candidate_series, comparator_series).
# When the script flags a new violation NOT in this dict, the output
# JSON's cross_source_diff_note remains None — a follow-up step must
# add an entry here. The validator below errors out in that case so
# the gate stays green only when human review has caught up.
# ──────────────────────────────────────────────────────────────────────
DIFF_NOTES: dict[tuple[str, str, str], str] = {
    ("bs_tga", "tga_balance_usd_m", "WTREGEN"): (
        "STALE-DATA ARTIFACT (not a real cross-source disagreement). "
        "Treasury Fiscal Data tga_balance_usd_m has been NULL since "
        "2022-04-16 in our snapshot (2336/3342 dates non-null), so the "
        "alignment falls back to 2022-04-15 where TGA daily=$578.5B vs "
        "FRED H.4.1 WTREGEN 2022-04-13=$547.3B. The +5.5% gap is the "
        "expected mid-week intra-period drift between Wed-stamped weekly "
        "H.4.1 and intra-week daily TGA, NOT a unit/concept mismatch. "
        "Resolution: S4.1 pipeline rerun must restore Treasury daily TGA "
        "freshness (R010 will track). Once both sides land at 2026-04 "
        "dates, expect <1% diff per S2.2 corr_36m=0.9834."
    ),
    ("us_treasury", "tga_balance_usd_m", "WTREGEN"): (
        "Identical root cause as bs_tga (same series pair). See "
        "bs_tga note. R010 tracks the Treasury snapshot freshness fix."
    ),
}


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _today() -> date:
    return date.today()


def _parse_date(s: str) -> date | None:
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def latest_obs(obs: dict[str, float]) -> tuple[str | None, float | None]:
    """Return (latest_date_str, latest_value) ignoring None / non-finite values."""
    if not obs:
        return None, None
    # Keys are YYYY-MM-DD strings; sort lexicographically (ISO-safe).
    for d in sorted(obs.keys(), reverse=True):
        v = obs[d]
        if v is None:
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv != fv:  # NaN
            continue
        return d, fv
    return None, None


def _clean_obs(obs: dict[str, float]) -> dict[str, float]:
    """Drop None / NaN / non-numeric entries; return {YYYY-MM-DD: float}."""
    out: dict[str, float] = {}
    for d, v in obs.items():
        if v is None:
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv != fv:
            continue
        out[d[:10]] = fv
    return out


def latest_common_obs(
    cand: dict[str, float], comp: dict[str, float], tolerance_days: int = 7
) -> tuple[str | None, float | None, str | None, float | None]:
    """Return (cand_date, cand_val, comp_date, comp_val) at the latest *aligned*
    timepoint per spec §AC#6 ("同时点跨源相对差值").

    Strategy: find the largest date `d` for which BOTH sides have an
    observation within `tolerance_days` of `d`. Walk candidate dates from
    newest to oldest; for each, look up the comparator obs at the same date,
    then back off up to `tolerance_days` days to handle weekly-vs-daily
    publication offsets (e.g., FRED H.4.1 prints Wednesday, NYFed daily
    prints every business day).
    """
    cand = _clean_obs(cand)
    comp = _clean_obs(comp)
    if not cand or not comp:
        return None, None, None, None

    comp_dates_sorted = sorted(comp.keys())
    comp_set = set(comp_dates_sorted)

    for cd in sorted(cand.keys(), reverse=True):
        # exact match first
        if cd in comp_set:
            return cd, cand[cd], cd, comp[cd]
        # back off up to tolerance: pick the latest comp date <= cd within window
        d0 = _parse_date(cd)
        if d0 is None:
            continue
        best_comp_date = None
        for od in reversed(comp_dates_sorted):
            d1 = _parse_date(od)
            if d1 is None:
                continue
            if d1 > d0:
                continue
            if (d0 - d1).days > tolerance_days:
                break  # comp_dates_sorted is asc; reversed walks desc; once gap exceeds tolerance, all earlier are worse
            best_comp_date = od
            break
        if best_comp_date is not None:
            return cd, cand[cd], best_comp_date, comp[best_comp_date]
    return None, None, None, None


def is_stale(latest_date_str: str | None, freq: str) -> bool:
    if not latest_date_str:
        return True
    d = _parse_date(latest_date_str)
    if d is None:
        return True
    threshold = STALE_DAYS.get(freq, 30)
    return (_today() - d).days > threshold


def relative_diff_pct(a: float, b: float) -> float | None:
    """(a - b) / mean(a, b) * 100. None if mean is 0."""
    mean = (a + b) / 2.0
    if mean == 0:
        return None
    return (a - b) / mean * 100.0


def parse_obj_block(raw: str) -> dict[str, str]:
    """Parse a `{ ... }` string as a top-level object key map."""
    return parse_object_keys("X=" + raw, r"X=\s*\{")


def extract_proxy_fields(raw_obj: str) -> dict[str, str | None]:
    """From a raw `{proxy_id:"X", source:"Y", ...}` block, pull the typed fields."""
    fields: dict[str, str | None] = {
        "proxy_id": None,
        "source": None,
        "metric": None,
        "units": None,
        "frequency": None,
    }
    for k in fields:
        m = re.search(rf'\b{k}\s*:\s*"([^"]*)"', raw_obj)
        if m:
            fields[k] = m.group(1)
    return fields


def extract_alt_list(alts_raw: str) -> list[dict[str, str | None]]:
    """Split a `[{...},{...}]` string into a list of proxy-field dicts."""
    out: list[dict[str, str | None]] = []
    if not alts_raw or alts_raw.strip() in ("[]", ""):
        return out
    body = alts_raw.strip()
    if body.startswith("["):
        body = body[1:-1]
    # Walk balanced { ... } chunks
    depth = 0
    start = -1
    for i, c in enumerate(body):
        if c == "{":
            if depth == 0:
                start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                out.append(extract_proxy_fields(body[start : i + 1]))
                start = -1
    return out


# ──────────────────────────────────────────────────────────────────────
# Pair construction
# ──────────────────────────────────────────────────────────────────────
def build_set_a_pairs(anchors: dict, registry: dict[str, dict[str, str]]) -> list[dict]:
    """One pair per cross-source anchor row (anchor != 'self')."""
    rows = []
    for nid, v in anchors.items():
        if not isinstance(v, dict):
            continue
        if v.get("anchor") == "self":
            continue
        cand = v.get("candidate", {})
        anc = v.get("anchor", {})
        if not isinstance(cand, dict) or not isinstance(anc, dict):
            continue
        # We need units for conversion — pull from registry primary if available.
        prim = registry.get(nid, {}).get("primary_fields", {})
        cand_units = prim.get("units") or "Mil. USD"
        # Anchor units: best-effort from a small lookup table (FRED H.4.1 = Mil. USD,
        # NYFed rrp_ops = Mil. USD per nyfed_config.py, FRED WTREGEN = Mil. USD,
        # FRED WALCL = Mil. USD, FRED RRPONTTLD = Bil. USD).
        anchor_units_lookup = {
            "WALCL": "Mil. USD",
            "WTREGEN": "Mil. USD",
            "RRPONTTLD": "Bil. USD",
            "rrp_ops": "Mil. USD",
        }
        anc_units = anchor_units_lookup.get(anc.get("series", ""), cand_units)
        rows.append({
            "node_id": nid,
            "kind": "anchor",
            "candidate": {
                "source": cand.get("source"),
                "series": cand.get("series"),
                "metric": cand.get("metric"),
                "units": cand_units,
                "frequency": cand.get("freq"),
            },
            "comparator": {
                "source": anc.get("source"),
                "series": anc.get("series"),
                "metric": anc.get("metric"),
                "units": anc_units,
                "frequency": anc.get("freq"),
            },
        })
    return rows


def build_set_b_pairs(registry: dict[str, dict]) -> list[dict]:
    """One pair per (primary, alternate) where primary is non-null."""
    rows = []
    for nid, ent in registry.items():
        prim = ent.get("primary_fields") or {}
        if not prim.get("proxy_id"):
            continue
        for alt in ent.get("alternates_fields", []):
            if not alt.get("proxy_id"):
                continue
            rows.append({
                "node_id": nid,
                "kind": "alternate",
                "candidate": {
                    "source": prim.get("source"),
                    "series": prim.get("proxy_id"),
                    "metric": prim.get("metric"),
                    "units": prim.get("units"),
                    "frequency": prim.get("frequency"),
                },
                "comparator": {
                    "source": alt.get("source"),
                    "series": alt.get("proxy_id"),
                    "metric": alt.get("metric"),
                    "units": alt.get("units"),
                    "frequency": alt.get("frequency"),
                },
            })
    return rows


# ──────────────────────────────────────────────────────────────────────
# Registry parser
# ──────────────────────────────────────────────────────────────────────
def parse_registry() -> dict[str, dict]:
    src = REGISTRY_JS.read_text(encoding="utf-8")
    nodes_raw = parse_object_keys(src, r"NODE_PROXIES\s*=\s*\{")
    out: dict[str, dict] = {}
    for nid, body in nodes_raw.items():
        sub = parse_obj_block(body)
        prim_raw = sub.get("primary", "null")
        if prim_raw.strip() == "null":
            prim_fields = {"proxy_id": None}
        else:
            prim_fields = extract_proxy_fields(prim_raw)
        alts_raw = sub.get("alternates", "[]")
        alts_fields = extract_alt_list(alts_raw)
        out[nid] = {
            "primary_fields": prim_fields,
            "alternates_fields": alts_fields,
        }
    return out


# ──────────────────────────────────────────────────────────────────────
# Diff computation
# ──────────────────────────────────────────────────────────────────────
def compute_pair(store: SeriesStore, pair: dict) -> dict:
    nid = pair["node_id"]
    c = pair["candidate"]
    o = pair["comparator"]

    # Identify same_concept / substitute classification
    key = (nid, c["series"], o["series"])
    is_substitute = key in SUBSTITUTE_PAIRS
    is_same_concept = key in SAME_CONCEPT_PAIRS

    # Skip if comparator side is null-comparator (shouldn't happen here)
    skip_reason = None

    cand_obs = store.fetch(c["source"], c["series"], c.get("metric"))
    comp_obs = store.fetch(o["source"], o["series"], o.get("metric"))

    # For 5%-rule pairs (same-concept or substitute) we need date-aligned obs;
    # for informational/different-concept pairs we just expose latest of each.
    if is_same_concept or is_substitute:
        # Tolerance scales with the slower side's frequency.
        tol = max(
            STALE_DAYS.get(c.get("frequency") or "irregular", 7),
            STALE_DAYS.get(o.get("frequency") or "irregular", 7),
        )
        cand_date, cand_val, comp_date, comp_val = latest_common_obs(
            cand_obs, comp_obs, tolerance_days=min(tol, 14)
        )
        # If alignment fails, fall back to per-side latest so the JSON still
        # surfaces both sides' freshness for human review.
        if cand_date is None:
            cand_date, cand_val = latest_obs(cand_obs)
            comp_date, comp_val = latest_obs(comp_obs)
    else:
        cand_date, cand_val = latest_obs(cand_obs)
        comp_date, comp_val = latest_obs(comp_obs)

    cand_stale = is_stale(cand_date, c.get("frequency") or "irregular")
    comp_stale = is_stale(comp_date, o.get("frequency") or "irregular")

    # Unit conversion: only for same_concept (or substitute) pairs.
    units_normalized = False
    cand_norm = cand_val
    comp_norm = comp_val
    rel_pct: float | None = None

    if is_same_concept or is_substitute:
        cand_factor = UNIT_TO_MIL_USD.get(
            UNIT_OVERRIDES.get((c.get("source") or "", c.get("series") or ""), c.get("units") or "")
        )
        comp_factor = UNIT_TO_MIL_USD.get(
            UNIT_OVERRIDES.get((o.get("source") or "", o.get("series") or ""), o.get("units") or "")
        )
        if cand_val is None or comp_val is None:
            skip_reason = "data-missing"
        elif cand_factor is None or comp_factor is None:
            skip_reason = "units-not-convertible"
        else:
            cand_norm = cand_val * cand_factor
            comp_norm = comp_val * comp_factor
            units_normalized = (c.get("units") != o.get("units"))
            rel_pct = relative_diff_pct(cand_norm, comp_norm)
    else:
        # Different-concept pair: surface latest values but do NOT compute diff.
        skip_reason = "different-concept (informational only)"

    # 5% rule fires only for same-concept, non-substitute, both values present.
    violates = False
    if rel_pct is not None and is_same_concept and not is_substitute:
        violates = abs(rel_pct) > 5.0

    # Priority source determination.
    # Default: primary (= candidate). Downgrade to comparator iff candidate is stale
    # AND comparator is not stale.
    priority = "primary" if pair["kind"] == "alternate" else "candidate"
    if cand_stale and not comp_stale:
        priority = "alternate" if pair["kind"] == "alternate" else "anchor"

    return {
        "node_id": nid,
        "kind": pair["kind"],
        "candidate": {
            **c,
            "latest_date": cand_date,
            "latest_value": cand_val,
            "stale": cand_stale,
        },
        "comparator": {
            **o,
            "latest_date": comp_date,
            "latest_value": comp_val,
            "stale": comp_stale,
        },
        "same_concept": is_same_concept,
        "substitute": is_substitute,
        "units_normalized": units_normalized,
        "candidate_value_norm_mil_usd": cand_norm,
        "comparator_value_norm_mil_usd": comp_norm,
        "relative_diff_pct": rel_pct,
        "violates_5pct_rule": violates,
        "priority_source": priority,
        "diff_note_required": violates,
        "cross_source_diff_note": DIFF_NOTES.get(
            (nid, c.get("series") or "", o.get("series") or "")
        ) if violates else None,
        "skip_reason": skip_reason,
    }


# ──────────────────────────────────────────────────────────────────────
# Driver
# ──────────────────────────────────────────────────────────────────────
def main() -> int:
    store = SeriesStore()
    registry = parse_registry()
    anchors_doc = json.loads(ANCHORS_JSON.read_text(encoding="utf-8"))
    anchors = anchors_doc.get("anchors", {})

    # Build pair inventory; dedupe (node_id, candidate.series, comparator.series).
    seen: set[tuple[str, str, str]] = set()
    pairs: list[dict] = []
    for p in build_set_a_pairs(anchors, registry) + build_set_b_pairs(registry):
        key = (p["node_id"], p["candidate"]["series"] or "", p["comparator"]["series"] or "")
        if key in seen:
            continue
        seen.add(key)
        pairs.append(p)

    results = [compute_pair(store, p) for p in pairs]

    same_concept_n = sum(1 for r in results if r["same_concept"])
    violations = [r for r in results if r["violates_5pct_rule"]]
    substitutes = [r for r in results if r["substitute"]]
    uncovered = [
        r for r in violations if r["cross_source_diff_note"] is None
    ]

    out = {
        "_doc": (
            "S2.5 cross-source diff scanner output. The 5% rule (spec AC#6) "
            "fires only for same_concept=True, substitute=False pairs where "
            "both sides have a numeric latest observation. See decisions.md "
            "D-005 for substitute-pair exemptions and stale thresholds."
        ),
        "_schema_version": "1.0",
        "generated_at": datetime.now().replace(microsecond=0).isoformat(),
        "stale_thresholds_days": STALE_DAYS,
        "substitute_pairs": sorted(
            {f"{nid}:{c}:{a}" for nid, c, a in SUBSTITUTE_PAIRS}
        ),
        "same_concept_pairs": sorted(
            {f"{nid}:{c}:{a}" for nid, c, a in SAME_CONCEPT_PAIRS}
        ),
        "summary": {
            "total_pairs": len(results),
            "same_concept_pairs": same_concept_n,
            "substitute_pairs_count": len(substitutes),
            "violations_5pct": len(violations),
            "violation_node_ids": sorted({r["node_id"] for r in violations}),
        },
        "pairs": results,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(out, indent=2, sort_keys=False, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("=" * 64)
    print("S2.5 — Cross-source latest-observation diff")
    print("=" * 64)
    print(f"  total pairs       : {len(results)}")
    print(f"  same-concept pairs: {same_concept_n}  (5% rule active)")
    print(f"  substitute pairs  : {len(substitutes)}  (D-005 exempt)")
    print(f"  >5% violations    : {len(violations)}")
    if violations:
        for r in violations:
            print(
                f"    ! {r['node_id']:24s}  "
                f"{r['candidate']['series']} vs {r['comparator']['series']}  "
                f"diff={r['relative_diff_pct']:+.2f}%"
            )
    print(f"  output: {OUT_JSON.relative_to(ROOT)}")
    if uncovered:
        print()
        print("  ⚠  violations missing a curated DIFF_NOTES entry:")
        for r in uncovered:
            print(
                f"     - {r['node_id']} : "
                f"{r['candidate']['series']} vs {r['comparator']['series']}"
            )
        print("  → add an entry to DIFF_NOTES and re-run; gate cannot pass otherwise.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
