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


# ── v2 additive exports ──────────────────────────────────────────────────
# Produces 4 NEW JSON files; v1 outputs above are not touched.

from series_config import FRED_SERIES_V2  # noqa: E402


def _series_to_dict(cur, series_id):
    """Return {date: value} for a series_id from the observations table."""
    return {
        d: v for d, v in cur.execute(
            "SELECT date, value FROM observations WHERE series_id = ? "
            "ORDER BY date", (series_id,)
        )
    }


def _nyfed_metric_dict(cur, series_name, metric):
    return {
        d: v for d, v in cur.execute(
            "SELECT record_date, value FROM nyfed_observations "
            "WHERE series_name = ? AND metric = ? ORDER BY record_date",
            (series_name, metric),
        )
    }


def _treasury_balance_dict(cur):
    """Unified TGA balance time series (handles 2013→2026 schema changes)."""
    return {
        d: v for d, v in cur.execute(
            "SELECT record_date, value FROM treasury_observations "
            "WHERE series_name = 'tga_daily' "
            "AND sub_category IN ("
            "  'Federal Reserve Account',"
            "  'Treasury General Account (TGA)',"
            "  'Treasury General Account (TGA) Closing Balance')"
            "ORDER BY record_date"
        )
    }


def export_fed_balance_sheet(conn):
    cur = conn.cursor()
    series = ["WALCL", "WRESBAL", "WTREGEN", "WLRRAL",
              "WLCFLPCL", "WLCFOCEL", "H41RESPPALDKNWW", "TREAST"]
    payload = {sid: _series_to_dict(cur, sid) for sid in series}
    out = OUT_DIR / "fed_balance_sheet.json"
    out.write_text(json.dumps(payload, indent=1))
    return out


def export_treasury_flows(conn):
    cur = conn.cursor()
    payload = {
        "tga_balance_usd_m": _treasury_balance_dict(cur),
        "auctions_btc_by_term": {},
    }
    # auctions: group by sub_category (security_type|term)
    for d, sub, v in cur.execute(
        "SELECT record_date, sub_category, value FROM treasury_observations "
        "WHERE series_name = 'auctions_btc' ORDER BY record_date"
    ):
        payload["auctions_btc_by_term"].setdefault(sub, {})[d] = v
    out = OUT_DIR / "treasury_flows.json"
    out.write_text(json.dumps(payload, indent=1))
    return out


def export_nyfed_operations(conn):
    cur = conn.cursor()
    payload = {
        "sofr": {
            "rate":   _nyfed_metric_dict(cur, "sofr", "rate"),
            "pct1":   _nyfed_metric_dict(cur, "sofr", "pct1"),
            "pct25":  _nyfed_metric_dict(cur, "sofr", "pct25"),
            "pct75":  _nyfed_metric_dict(cur, "sofr", "pct75"),
            "pct99":  _nyfed_metric_dict(cur, "sofr", "pct99"),
            "volume": _nyfed_metric_dict(cur, "sofr", "volume"),
        },
        "effr": {
            "rate":   _nyfed_metric_dict(cur, "effr", "rate"),
            "pct1":   _nyfed_metric_dict(cur, "effr", "pct1"),
            "pct99":  _nyfed_metric_dict(cur, "effr", "pct99"),
            "volume": _nyfed_metric_dict(cur, "effr", "volume"),
        },
        "rrp_ops": {
            "amt_accepted":   _nyfed_metric_dict(cur, "rrp_ops", "amt_accepted"),
            "amt_submitted":  _nyfed_metric_dict(cur, "rrp_ops", "amt_submitted"),
            "counterparties": _nyfed_metric_dict(cur, "rrp_ops", "counterparties"),
        },
        "srf_ops": {
            "amt_accepted":   _nyfed_metric_dict(cur, "srf_ops", "amt_accepted"),
            "amt_submitted":  _nyfed_metric_dict(cur, "srf_ops", "amt_submitted"),
        },
        "soma_summary": {
            metric: _nyfed_metric_dict(cur, "soma_summary", metric)
            for metric in
            ("total", "bills", "notesbonds", "tips", "frn",
             "mbs", "cmbs", "agencies")
        },
    }
    out = OUT_DIR / "nyfed_operations.json"
    out.write_text(json.dumps(payload, indent=1))
    return out


def export_pressure_indicators(conn):
    cur = conn.cursor()
    indicators = [
        row[0] for row in
        cur.execute("SELECT DISTINCT indicator FROM derived_indicators")
    ]
    payload = {}
    for ind in indicators:
        payload[ind] = {
            d: v for d, v in cur.execute(
                "SELECT record_date, value FROM derived_indicators "
                "WHERE indicator = ? ORDER BY record_date", (ind,)
            )
        }
    out = OUT_DIR / "pressure_indicators.json"
    out.write_text(json.dumps(payload, indent=1))
    return out


def export_v2_all():
    conn = sqlite3.connect(DB_PATH)
    files = [
        export_fed_balance_sheet(conn),
        export_treasury_flows(conn),
        export_nyfed_operations(conn),
        export_pressure_indicators(conn),
    ]
    conn.close()
    for f in files:
        print(f"[v2 export] {f.name}  {f.stat().st_size//1024} KB")


if __name__ == "__main__":
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"{DB_PATH} not found. Run build_database.py first."
        )
    export()
    export_v2_all()
