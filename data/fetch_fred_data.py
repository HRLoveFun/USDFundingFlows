"""
Download all FRED series defined in series_config.py.
Saves raw CSV-like data; build_database.py handles DB import.
"""
import os
import sys
import time
import json
from pathlib import Path

from dotenv import load_dotenv
from fredapi import Fred

from series_config import FRED_SERIES, FRED_SERIES_V2

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

FRED_API_KEY = os.getenv("FRED_API_KEY")
if not FRED_API_KEY:
    sys.exit("ERROR: FRED_API_KEY not set. Copy .env.example → .env and add your key.")

fred = Fred(api_key=FRED_API_KEY)

START_DATE = "2013-01-01"
MIN_INTERVAL = 0.6          # 120 req/min FRED limit
MAX_RETRIES = 3
OUTPUT_DIR = Path(__file__).resolve().parent / "json"
OUTPUT_DIR.mkdir(exist_ok=True)

results = {}
failed = []

for i, (series_id, meta) in enumerate(FRED_SERIES.items(), 1):
    print(f"[{i}/{len(FRED_SERIES)}] Fetching {series_id} … ", end="", flush=True)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            time.sleep(MIN_INTERVAL)
            s = fred.get_series(series_id, observation_start=START_DATE)
            # s is a pandas Series with DatetimeIndex
            data = {d.strftime("%Y-%m-%d"): (None if v != v else v)   # NaN → None
                    for d, v in s.items()}
            results[series_id] = data
            print(f"OK ({len(data)} obs)")
            break
        except Exception as e:
            wait = MIN_INTERVAL * (2 ** attempt)
            print(f"retry {attempt}/{MAX_RETRIES} ({e})", end=" ", flush=True)
            time.sleep(wait)
    else:
        print("FAILED")
        failed.append(series_id)

# Write raw observations to JSON for build_database.py
out_path = OUTPUT_DIR / "raw_observations.json"
with open(out_path, "w") as f:
    json.dump(results, f)

print(f"\nDone. {len(results)} series saved to {out_path}")
if failed:
    print(f"Failed series ({len(failed)}): {failed}")


# ── v2 additive fetch ─────────────────────────────────────────────────────
# Fetches the FRED_SERIES_V2 series into a SEPARATE file so v1's
# raw_observations.json stays byte-equivalent.
results_v2 = {}
failed_v2 = []
for i, (series_id, meta) in enumerate(FRED_SERIES_V2.items(), 1):
    print(f"[v2 {i}/{len(FRED_SERIES_V2)}] Fetching {series_id} … ",
          end="", flush=True)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            time.sleep(MIN_INTERVAL)
            s = fred.get_series(series_id, observation_start=START_DATE)
            data = {d.strftime("%Y-%m-%d"): (None if v != v else v)
                    for d, v in s.items()}
            results_v2[series_id] = data
            print(f"OK ({len(data)} obs)")
            break
        except Exception as e:
            wait = MIN_INTERVAL * (2 ** attempt)
            print(f"retry {attempt}/{MAX_RETRIES} ({e})", end=" ", flush=True)
            time.sleep(wait)
    else:
        print("FAILED")
        failed_v2.append(series_id)

out_path_v2 = OUTPUT_DIR / "raw_observations_v2.json"
with open(out_path_v2, "w") as f:
    json.dump(results_v2, f)

print(f"\n[v2] Done. {len(results_v2)} series saved to {out_path_v2}")
if failed_v2:
    print(f"[v2] Failed series ({len(failed_v2)}): {failed_v2}")
