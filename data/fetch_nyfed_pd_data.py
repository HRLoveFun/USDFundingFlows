"""
NY Fed Primary Dealer Statistics fetcher.

Output: data/raw/nyfed_pd/<alias>.json

Fail-soft: HTTP / decode errors are logged and skipped; exit 0 always.
"""
import json
import ssl
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nyfed_pd_config import NYFED_PD_BASE, NYFED_PD_SERIES  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "raw" / "nyfed_pd"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TIMEOUT = 30
SLEEP_BETWEEN = 0.3
USER_AGENT = "USDFundingFlows-IEF/0.2"


def _http_get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_series(alias: str, cfg: dict) -> dict | None:
    keyid = cfg["keyid"]
    url = f"{NYFED_PD_BASE}/pd/get/{keyid}.json"
    try:
        payload = _http_get_json(url)
    except Exception as e:
        print(f"[nyfed_pd] WARN {alias} ({keyid}): {type(e).__name__}: {e}")
        return None
    rows = payload.get("pd", {}).get("timeseries", [])
    out: dict[str, float | None] = {}
    for r in rows:
        d = r.get("asofdate")
        v = r.get("value")
        if not isinstance(d, str):
            continue
        try:
            num = None if v in (None, "", "*") else float(v)
        except (TypeError, ValueError):
            num = None
        out[d] = num
    return out


def main() -> int:
    saved = skipped = 0
    for alias, cfg in NYFED_PD_SERIES.items():
        print(f"[nyfed_pd] fetching {alias} ({cfg['keyid']}) …", flush=True)
        data = fetch_series(alias, cfg)
        if not data:
            skipped += 1
            time.sleep(SLEEP_BETWEEN)
            continue
        (OUT_DIR / f"{alias}.json").write_text(
            json.dumps(
                {
                    "alias": alias,
                    "keyid": cfg["keyid"],
                    "freq": cfg["freq"],
                    "units": cfg["units"],
                    "note": cfg["note"],
                    "observations": data,
                },
                indent=2,
            )
        )
        print(f"[nyfed_pd] saved {len(data):>5} obs → {alias}.json")
        saved += 1
        time.sleep(SLEEP_BETWEEN)
    print(f"\n[nyfed_pd] done. saved={saved} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
