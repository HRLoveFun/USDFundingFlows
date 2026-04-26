"""
Treasury Fiscal Data API — paginated REST fetcher (no auth required).

Output: data/raw/treasury/<endpoint>.json
"""
import json
import time
from pathlib import Path

import requests

from treasury_config import TREASURY_BASE, TREASURY_ENDPOINTS

OUT_DIR = Path(__file__).resolve().parent / "raw" / "treasury"
OUT_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_START = "2013-01-01"
PAGE_SIZE = 10000
SLEEP_BETWEEN_PAGES = 0.2
TIMEOUT = 60


def fetch_endpoint(name: str, start_date: str = DEFAULT_START) -> list[dict]:
    cfg = TREASURY_ENDPOINTS[name]
    url = f"{TREASURY_BASE}{cfg['path']}"
    rows: list[dict] = []
    page = 1
    while True:
        params = {
            "fields": ",".join(cfg["fields"]),
            "filter": cfg["filter_template"].format(start_date=start_date),
            "page[size]": PAGE_SIZE,
            "page[number]": page,
            "format": "json",
        }
        resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        rows.extend(payload.get("data", []))
        meta = payload.get("meta", {})
        total_pages = meta.get("total-pages", 1)
        if page >= total_pages:
            break
        page += 1
        time.sleep(SLEEP_BETWEEN_PAGES)
    return rows


def main():
    for name in TREASURY_ENDPOINTS:
        print(f"[treasury] fetching {name} …", flush=True)
        try:
            rows = fetch_endpoint(name)
        except Exception as e:
            print(f"[treasury] FAILED {name}: {e}")
            continue
        out = OUT_DIR / f"{name}.json"
        out.write_text(json.dumps(rows, indent=2))
        print(f"[treasury] saved {len(rows):>6} rows → {out}")


if __name__ == "__main__":
    main()
