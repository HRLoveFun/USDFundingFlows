"""
Create/populate SQLite database from fetched FRED data.
Reads raw_observations.json (from fetch_fred_data.py) and series_config.py.
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from series_config import FRED_SERIES

DB_PATH = Path(__file__).resolve().parent / "funding_flows.db"
RAW_PATH = Path(__file__).resolve().parent / "json" / "raw_observations.json"


def create_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS series_metadata (
            series_id TEXT PRIMARY KEY,
            name TEXT,
            units TEXT,
            frequency TEXT,
            transaction_type TEXT,
            node_id TEXT,
            last_updated TEXT
        );
        CREATE TABLE IF NOT EXISTS observations (
            series_id TEXT,
            date TEXT,
            value REAL,
            PRIMARY KEY (series_id, date)
        );
    """)


def populate(conn):
    with open(RAW_PATH) as f:
        raw = json.load(f)

    now = datetime.utcnow().isoformat()

    # Metadata
    for sid, meta in FRED_SERIES.items():
        tt = meta.get("transaction_type")
        # transaction_type may be a string or list; serialize lists as JSON
        if isinstance(tt, list):
            tt = json.dumps(tt)
        conn.execute(
            "INSERT OR REPLACE INTO series_metadata VALUES (?,?,?,?,?,?,?)",
            (sid, meta["name"], meta["units"], meta["frequency"],
             tt, json.dumps(meta["node_ids"]), now),
        )

    # Observations
    rows = []
    for sid, obs in raw.items():
        for date_str, val in obs.items():
            if val is not None:
                rows.append((sid, date_str, val))
    conn.executemany(
        "INSERT OR REPLACE INTO observations VALUES (?,?,?)", rows
    )
    conn.commit()
    return len(rows)


if __name__ == "__main__":
    if not RAW_PATH.exists():
        raise FileNotFoundError(
            f"{RAW_PATH} not found. Run fetch_fred_data.py first."
        )
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    n = populate(conn)
    conn.close()
    print(f"Database: {DB_PATH}")
    print(f"Inserted {n} observations for {len(FRED_SERIES)} series.")
