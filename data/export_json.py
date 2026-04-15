"""
Export SQLite data to frontend-consumable JSON files.
Aligns mixed-frequency series to quarter-end dates using "as-of" logic:
for each quarter-end, take each series' most recent observation on or before that date.

Produces:
  data/json/time_series.json      – { "2024-03-31": { "EFFR": 5.33, … }, … }
  data/json/series_metadata.json  – { "EFFR": { name, units, … }, … }
  data/json/available_dates.json  – ["2013-03-31", "2013-06-30", …]
"""
import json
import sqlite3
from pathlib import Path

from series_config import FRED_SERIES

DB_PATH = Path(__file__).resolve().parent / "funding_flows.db"
OUT_DIR = Path(__file__).resolve().parent / "json"
OUT_DIR.mkdir(exist_ok=True)


def quarter_end_dates():
    """Generate quarter-end dates from 2013-Q1 to 2026-Q1."""
    dates = []
    for year in range(2013, 2027):
        for month, day in [(3, 31), (6, 30), (9, 30), (12, 31)]:
            dates.append(f"{year}-{month:02d}-{day:02d}")
    # Trim future dates
    dates = [d for d in dates if d <= "2026-03-31"]
    return dates


def export():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    dates = quarter_end_dates()

    # Fetch all observations ordered by date
    all_series_ids = list(FRED_SERIES.keys())

    # Build as-of lookup: for each series+quarter_end, find latest obs <= date
    time_series = {}
    for qdate in dates:
        values = {}
        for sid in all_series_ids:
            row = cur.execute(
                "SELECT value FROM observations "
                "WHERE series_id = ? AND date <= ? "
                "ORDER BY date DESC LIMIT 1",
                (sid, qdate),
            ).fetchone()
            if row is not None:
                values[sid] = row[0]
        if values:
            time_series[qdate] = values

    # Only keep dates that have at least some data
    available_dates = sorted(time_series.keys())

    # Series metadata
    metadata = {}
    for sid, meta in FRED_SERIES.items():
        tt = meta.get("transaction_type")
        # Normalize to list for JSON output if it's a single string
        if isinstance(tt, str):
            tt = [tt]
        metadata[sid] = {
            "name": meta["name"],
            "units": meta["units"],
            "frequency": meta["frequency"],
            "transaction_type": tt,
            "node_ids": meta["node_ids"],
        }

    # Write files
    with open(OUT_DIR / "time_series.json", "w") as f:
        json.dump(time_series, f, indent=1)
    with open(OUT_DIR / "series_metadata.json", "w") as f:
        json.dump(metadata, f, indent=1)
    with open(OUT_DIR / "available_dates.json", "w") as f:
        json.dump(available_dates, f, indent=1)

    conn.close()
    print(f"Exported {len(available_dates)} quarter-end dates, "
          f"{len(metadata)} series to {OUT_DIR}/")


if __name__ == "__main__":
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"{DB_PATH} not found. Run build_database.py first."
        )
    export()
