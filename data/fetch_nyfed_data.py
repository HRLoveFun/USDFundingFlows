"""
NY Fed Markets API — REST fetcher (no auth required).

Output: data/raw/nyfed/<endpoint>.json
"""
import json
from pathlib import Path

import requests

from nyfed_config import NYFED_BASE, NYFED_ENDPOINTS

OUT_DIR = Path(__file__).resolve().parent / "raw" / "nyfed"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TIMEOUT = 60


def _drill(payload, keys):
    """Walk through a nested dict envelope, extracting the first list found."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in keys:
            if k in payload:
                return _drill(payload[k], keys)
        # also try common operations sub-key
        for k in ("operations", "holdings", "data", "summary"):
            if k in payload:
                return _drill(payload[k], keys)
    return []


def fetch_endpoint(name: str) -> list[dict]:
    cfg = NYFED_ENDPOINTS[name]
    url = f"{NYFED_BASE}{cfg['path']}"
    resp = requests.get(url, params=cfg["params"], timeout=TIMEOUT)
    resp.raise_for_status()
    payload = resp.json()
    rows = _drill(payload, cfg.get("response_keys", []))
    if not isinstance(rows, list):
        rows = []
    return rows


def filter_fields(rows: list[dict], keep: list[str]) -> list[dict]:
    return [{k: r.get(k) for k in keep if k in r} for r in rows]


def main():
    for name, cfg in NYFED_ENDPOINTS.items():
        print(f"[nyfed] fetching {name} …", flush=True)
        try:
            rows = fetch_endpoint(name)
        except Exception as e:
            print(f"[nyfed] FAILED {name}: {e}")
            continue
        rows = filter_fields(rows, cfg["fields_keep"])
        out = OUT_DIR / f"{name}.json"
        out.write_text(json.dumps(rows, indent=2))
        print(f"[nyfed] saved {len(rows):>6} rows → {out}")


if __name__ == "__main__":
    main()
