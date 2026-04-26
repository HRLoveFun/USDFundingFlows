"""
CFTC TFF (Traders in Financial Futures) Socrata fetcher.

Output: data/raw/cftc/<alias>.json

Fail-soft: HTTP / parse errors are logged and skipped; exit 0 always.
"""
import json
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cftc_config import CFTC_BASE, CFTC_SERIES  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "raw" / "cftc"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TIMEOUT = 45
SLEEP_BETWEEN = 0.4
PAGE_SIZE = 5000
USER_AGENT = "USDFundingFlows-IEF/0.2"


def _http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
        return resp.read()


def fetch_series(alias: str, cfg: dict) -> list[dict] | None:
    rid = cfg["resource_id"]
    rows: list[dict] = []
    offset = 0
    select = ",".join(cfg["keep_fields"])
    while True:
        params = {
            "$select": select,
            "$where": cfg["where"],
            "$order": "report_date_as_yyyy_mm_dd ASC",
            "$limit": PAGE_SIZE,
            "$offset": offset,
        }
        url = f"{CFTC_BASE}/{rid}.json?" + urllib.parse.urlencode(params)
        try:
            body = _http_get(url)
            page = json.loads(body.decode("utf-8", errors="replace"))
        except Exception as e:
            print(f"[cftc] WARN {alias}: {type(e).__name__}: {e}")
            return None
        if not isinstance(page, list) or not page:
            break
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(SLEEP_BETWEEN)
    return rows


def main() -> int:
    saved = skipped = 0
    for alias, cfg in CFTC_SERIES.items():
        print(f"[cftc] fetching {alias} ({cfg['resource_id']}) …", flush=True)
        rows = fetch_series(alias, cfg)
        if rows is None:
            skipped += 1
            continue
        (OUT_DIR / f"{alias}.json").write_text(
            json.dumps(
                {
                    "alias": alias,
                    "resource_id": cfg["resource_id"],
                    "where": cfg["where"],
                    "freq": cfg["freq"],
                    "units": cfg["units"],
                    "note": cfg["note"],
                    "rows": rows,
                },
                indent=2,
            )
        )
        print(f"[cftc] saved {len(rows):>5} rows → {alias}.json")
        saved += 1
        time.sleep(SLEEP_BETWEEN)
    print(f"\n[cftc] done. saved={saved} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
