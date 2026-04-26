"""
Create/populate SQLite database from fetched FRED data.
Reads raw_observations.json (from fetch_fred_data.py) and series_config.py.
"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from series_config import FRED_SERIES, FRED_SERIES_V2

DB_PATH = Path(__file__).resolve().parent / "funding_flows.db"
RAW_PATH = Path(__file__).resolve().parent / "json" / "raw_observations.json"
RAW_V2_PATH = Path(__file__).resolve().parent / "json" / "raw_observations_v2.json"
TREASURY_RAW_DIR = Path(__file__).resolve().parent / "raw" / "treasury"
NYFED_RAW_DIR = Path(__file__).resolve().parent / "raw" / "nyfed"


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

        -- v2 additive tables (do not affect v1 schema/usage) -------------
        CREATE TABLE IF NOT EXISTS series_metadata_v2 (
            series_id TEXT PRIMARY KEY,
            name TEXT,
            units TEXT,
            frequency TEXT,
            grp TEXT,
            node_id TEXT,
            last_updated TEXT
        );
        CREATE TABLE IF NOT EXISTS treasury_observations (
            record_date  TEXT NOT NULL,
            series_name  TEXT NOT NULL,
            sub_category TEXT,
            value        REAL,
            PRIMARY KEY (record_date, series_name, sub_category)
        );
        CREATE TABLE IF NOT EXISTS nyfed_observations (
            record_date  TEXT NOT NULL,
            series_name  TEXT NOT NULL,
            metric       TEXT NOT NULL,
            value        REAL,
            PRIMARY KEY (record_date, series_name, metric)
        );
        CREATE TABLE IF NOT EXISTS derived_indicators (
            record_date  TEXT NOT NULL,
            indicator    TEXT NOT NULL,
            value        REAL,
            PRIMARY KEY (record_date, indicator)
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


# ── v2 additive loaders ─────────────────────────────────────────────────

def _to_float(x):
    if x is None or x == "":
        return None
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def populate_v2(conn):
    """Load FRED_SERIES_V2 raw observations into the shared `observations`
    table (using each v2 series_id as a fresh key) and write metadata to
    `series_metadata_v2`. v1 rows in `observations` are unaffected."""
    if not RAW_V2_PATH.exists():
        print(f"[v2] {RAW_V2_PATH} missing — skipping v2 FRED load.")
        return 0
    with open(RAW_V2_PATH) as f:
        raw = json.load(f)
    now = datetime.utcnow().isoformat()
    for sid, meta in FRED_SERIES_V2.items():
        conn.execute(
            "INSERT OR REPLACE INTO series_metadata_v2 VALUES (?,?,?,?,?,?,?)",
            (sid, meta["name"], meta["units"], meta["frequency"],
             meta.get("group"), json.dumps(meta["node_ids"]), now),
        )
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


def load_treasury(conn):
    """Ingest data/raw/treasury/*.json into treasury_observations."""
    cur = conn.cursor()
    cur.execute("DELETE FROM treasury_observations")
    total = 0
    # tga_daily: rows have record_date, account_type, close_today_bal
    p = TREASURY_RAW_DIR / "tga_daily.json"
    if p.exists():
        rows = json.loads(p.read_text())
        out = [
            (r.get("record_date"), "tga_daily",
             r.get("account_type") or "ALL",
             _to_float(r.get("close_today_bal")))
            for r in rows
            if r.get("record_date") and r.get("close_today_bal") is not None
        ]
        cur.executemany(
            "INSERT OR REPLACE INTO treasury_observations VALUES (?,?,?,?)",
            out,
        )
        total += len(out)
    # auctions: variable shape; flatten to series_name='auctions'
    p = TREASURY_RAW_DIR / "auctions.json"
    if p.exists():
        rows = json.loads(p.read_text())
        out = []
        for r in rows:
            d = r.get("auction_date")
            if not d:
                continue
            sub = f"{r.get('security_type','?')}|{r.get('security_term','?')}"
            v = _to_float(r.get("bid_to_cover_ratio"))
            if v is None:
                continue
            out.append((d, "auctions_btc", sub, v))
        cur.executemany(
            "INSERT OR REPLACE INTO treasury_observations VALUES (?,?,?,?)",
            out,
        )
        total += len(out)
    conn.commit()
    return total


def load_nyfed(conn):
    """Ingest data/raw/nyfed/*.json into nyfed_observations.
    Each metric becomes a row keyed by (record_date, series_name, metric)."""
    cur = conn.cursor()
    cur.execute("DELETE FROM nyfed_observations")
    total = 0

    def _push(rows):
        nonlocal total
        cur.executemany(
            "INSERT OR REPLACE INTO nyfed_observations VALUES (?,?,?,?)",
            rows,
        )
        total += len(rows)

    # SOFR / EFFR — rate + percentiles + volume
    for name in ("sofr", "effr"):
        p = NYFED_RAW_DIR / f"{name}.json"
        if not p.exists():
            continue
        rows = json.loads(p.read_text())
        out = []
        for r in rows:
            d = r.get("effectiveDate")
            if not d:
                continue
            mapping = {
                "rate":   r.get("percentRate"),
                "pct1":   r.get("percentPercentile1"),
                "pct25":  r.get("percentPercentile25"),
                "pct75":  r.get("percentPercentile75"),
                "pct99":  r.get("percentPercentile99"),
                "volume": r.get("volumeInBillions"),
            }
            for metric, val in mapping.items():
                fv = _to_float(val)
                if fv is not None:
                    out.append((d, name, metric, fv))
        _push(out)

    # RRP / SRF operations — totals
    for name in ("rrp_ops", "srf_ops"):
        p = NYFED_RAW_DIR / f"{name}.json"
        if not p.exists():
            continue
        rows = json.loads(p.read_text())
        out = []
        for r in rows:
            d = r.get("operationDate")
            if not d:
                continue
            for metric_key, src_key in (
                ("amt_accepted",  "totalAmtAccepted"),
                ("amt_submitted", "totalAmtSubmitted"),
                ("counterparties", "acceptedCounterparties"),
            ):
                v = _to_float(r.get(src_key))
                if v is not None:
                    out.append((d, name, metric_key, v))
        _push(out)

    # SOMA summary — total holdings by security type (USD)
    p = NYFED_RAW_DIR / "soma_summary.json"
    if p.exists():
        rows = json.loads(p.read_text())
        out = []
        for r in rows:
            d = r.get("asOfDate")
            if not d:
                continue
            for metric in ("total", "bills", "notesbonds",
                           "tips", "frn", "mbs", "cmbs", "agencies"):
                v = _to_float(r.get(metric))
                if v is not None:
                    out.append((d, "soma_summary", metric, v))
        _push(out)

    conn.commit()
    return total


def compute_derived_indicators(conn):
    """Compute v2 spread/gap indicators from joined sources."""
    cur = conn.cursor()
    cur.execute("DELETE FROM derived_indicators")

    # SOFR - IORB spread (basis points)
    cur.execute("""
        INSERT OR REPLACE INTO derived_indicators (record_date, indicator, value)
        SELECT s.record_date,
               'sofr_iorb_spread_bps',
               ROUND((s.value - i.value) * 100, 2)
        FROM nyfed_observations s
        JOIN observations i
          ON i.series_id = 'IORB' AND i.date = s.record_date
        WHERE s.series_name = 'sofr' AND s.metric = 'rate'
    """)

    # EFFR - IORB spread (bps)
    cur.execute("""
        INSERT OR REPLACE INTO derived_indicators (record_date, indicator, value)
        SELECT e.record_date,
               'effr_iorb_spread_bps',
               ROUND((e.value - i.value) * 100, 2)
        FROM nyfed_observations e
        JOIN observations i
          ON i.series_id = 'IORB' AND i.date = e.record_date
        WHERE e.series_name = 'effr' AND e.metric = 'rate'
    """)

    # SOFR p99 - median (rate) gap (bps)  — intraday dispersion proxy
    cur.execute("""
        INSERT OR REPLACE INTO derived_indicators (record_date, indicator, value)
        SELECT a.record_date,
               'sofr_p99_median_gap_bps',
               ROUND((a.value - b.value) * 100, 2)
        FROM nyfed_observations a
        JOIN nyfed_observations b
          ON a.record_date = b.record_date
        WHERE a.series_name = 'sofr' AND a.metric = 'pct99'
          AND b.series_name = 'sofr' AND b.metric = 'rate'
    """)

    # ΔTGA 5-day (USD billions)
    # The DTS schema for TGA balance changed across time; union the three
    # balance-of-account labels into a single CTE before computing the delta.
    cur.execute("""
        WITH tga AS (
            SELECT record_date, value
            FROM treasury_observations
            WHERE series_name = 'tga_daily'
              AND sub_category IN (
                  'Federal Reserve Account',
                  'Treasury General Account (TGA)',
                  'Treasury General Account (TGA) Closing Balance'
              )
        )
        INSERT OR REPLACE INTO derived_indicators (record_date, indicator, value)
        SELECT t1.record_date,
               'tga_delta_5d_usd_b',
               ROUND((t1.value - t2.value) / 1000.0, 2)
        FROM tga t1
        JOIN tga t2
          ON t2.record_date = date(t1.record_date, '-5 days')
        WHERE t2.value IS NOT NULL
    """)

    conn.commit()
    n = cur.execute("SELECT COUNT(*) FROM derived_indicators").fetchone()[0]
    return n


# ────────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    if not RAW_PATH.exists():
        raise FileNotFoundError(
            f"{RAW_PATH} not found. Run fetch_fred_data.py first."
        )
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    n = populate(conn)
    n_v2 = populate_v2(conn)
    n_t = load_treasury(conn)
    n_y = load_nyfed(conn)
    n_d = compute_derived_indicators(conn)
    conn.close()
    print(f"Database: {DB_PATH}")
    print(f"Inserted {n} obs (v1, {len(FRED_SERIES)} series).")
    print(f"Inserted {n_v2} obs (v2 FRED, {len(FRED_SERIES_V2)} series).")
    print(f"Inserted {n_t} treasury rows; {n_y} nyfed rows.")
    print(f"Computed {n_d} derived indicator rows.")
