"""
Download all FRED series defined in series_config.py.
Saves raw JSON; build_database.py handles DB import.
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

START_DATE   = "2013-01-01"
MIN_INTERVAL = 0.6        # 120 req/min FRED limit
MAX_RETRIES  = 3
OUTPUT_DIR   = Path(__file__).resolve().parent / "json"
OUTPUT_DIR.mkdir(exist_ok=True)


def fetch_series_dict(series_dict, label):
    """Fetch every series in `series_dict` and return ({sid: {date: value}}, failed_list)."""
    results, failed = {}, []
    n = len(series_dict)
    for i, series_id in enumerate(series_dict, 1):
        print(f"[{label} {i}/{n}] Fetching {series_id} … ", end="", flush=True)
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                time.sleep(MIN_INTERVAL)
                s = fred.get_series(series_id, observation_start=START_DATE)
                results[series_id] = {
                    d.strftime("%Y-%m-%d"): (None if v != v else v)
                    for d, v in s.items()
                }
                print(f"OK ({len(results[series_id])} obs)")
                break
            except Exception as e:
                wait = MIN_INTERVAL * (2 ** attempt)
                print(f"retry {attempt}/{MAX_RETRIES} ({e})", end=" ", flush=True)
                time.sleep(wait)
        else:
            print("FAILED")
            failed.append(series_id)
    return results, failed


def write_results(results, failed, out_name, label):
    out_path = OUTPUT_DIR / out_name
    with open(out_path, "w") as f:
        json.dump(results, f)
    print(f"\n[{label}] Done. {len(results)} series saved to {out_path}")
    if failed:
        print(f"[{label}] Failed series ({len(failed)}): {failed}")


if __name__ == "__main__":
    r1, f1 = fetch_series_dict(FRED_SERIES,    "v1")
    write_results(r1, f1, "raw_observations.json",    "v1")
    r2, f2 = fetch_series_dict(FRED_SERIES_V2, "v2")
    write_results(r2, f2, "raw_observations_v2.json", "v2")
