"""
OFR (Office of Financial Research) REST fetcher.

Output: data/raw/ofr/<alias>.json

Fail-soft: any HTTP / decode / SSL error skips the offending series and
emits a warning; the script still exits 0 so it cannot break CI.

Optional auth: if OFR_API_KEY is set in the env, it is forwarded as
`?key=...` for all calls. Missing key is fine for the public timeseries
endpoint at /v1/series/timeseries.
"""
import gzip
import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# Allow running as `python3 data/fetch_ofr_data.py` from repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ofr_config import OFR_BASE, OFR_SERIES  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "raw" / "ofr"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TIMEOUT = 30
SLEEP_BETWEEN = 0.4
USER_AGENT = "USDFundingFlows-IEF/0.2"
API_KEY = os.getenv("OFR_API_KEY", "").strip()


def _http_get(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Encoding": "gzip",
            "Accept": "application/json",
        },
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding", "") == "gzip":
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        return raw


def fetch_series(alias: str, cfg: dict) -> dict | None:
    """Fetch one OFR series. Returns {date: value, ...} or None on failure."""
    params = {"mnemonic": cfg["mnemonic"]}
    if API_KEY:
        params["key"] = API_KEY
    url = f"{OFR_BASE}/series/timeseries?" + urllib.parse.urlencode(params)
    try:
        body = _http_get(url)
        payload = json.loads(body.decode("utf-8", errors="replace"))
    except Exception as e:
        print(f"[ofr] WARN  {alias} ({cfg['mnemonic']}): {type(e).__name__}: {e}")
        return None

    # Response shape is `[[date, value], ...]`.
    if not isinstance(payload, list):
        print(f"[ofr] WARN  {alias}: unexpected payload type {type(payload).__name__}")
        return None
    out: dict[str, float | None] = {}
    for row in payload:
        if not isinstance(row, list) or len(row) < 2:
            continue
        d, v = row[0], row[1]
        if not isinstance(d, str):
            continue
        # OFR returns floats or None; pass through.
        out[d] = v if (v is None or isinstance(v, (int, float))) else None
    return out


def main() -> int:
    if not API_KEY:
        print(
            "[ofr] note: OFR_API_KEY env var not set — using public timeseries endpoint "
            "(works without auth as of 2024; warn-not-fail per D-001)."
        )

    saved = 0
    skipped = 0
    for alias, cfg in OFR_SERIES.items():
        print(f"[ofr] fetching {alias} ({cfg['mnemonic']}) …", flush=True)
        data = fetch_series(alias, cfg)
        if data is None or not data:
            skipped += 1
            time.sleep(SLEEP_BETWEEN)
            continue
        out = OUT_DIR / f"{alias}.json"
        out.write_text(
            json.dumps(
                {
                    "alias": alias,
                    "mnemonic": cfg["mnemonic"],
                    "dataset": cfg["dataset"],
                    "freq": cfg["freq"],
                    "units_raw": cfg["units"],
                    "note": cfg["note"],
                    "observations": data,
                },
                indent=2,
            )
        )
        print(f"[ofr] saved {len(data):>5} obs → {out}")
        saved += 1
        time.sleep(SLEEP_BETWEEN)

    print(f"\n[ofr] done. saved={saved} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
