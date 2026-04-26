"""
CFTC Traders in Financial Futures (TFF) — Socrata public dataset catalog.

Free, no auth required.
Dataset: gpe5-46if  (TFF Financial Futures, weekly)
URL pattern: https://publicreporting.cftc.gov/resource/<id>.json?<query>

For each alias we encode a Socrata `$where` filter to pull rows for one
contract (e.g. UST 10Y note futures), then cache them as a per-alias JSON
file. The harness will collapse to per-week observations downstream.
"""

CFTC_BASE = "https://publicreporting.cftc.gov/resource"

# alias -> { resource_id, where (SoQL), keep_fields, freq, units }
CFTC_SERIES = {
    # Leveraged-money (hedge funds + CTAs) net short in 10Y UST note futures.
    # Long-running canonical proxy for HF cash-futures basis trade scale.
    "tff_ust_10y_lev_money": {
        "resource_id": "gpe5-46if",
        # Socrata SoQL — exact match on contract name. Numeric fields come
        # back as strings via the JSON API; the harness floats them.
        "where": "contract_market_name = 'UST 10Y NOTE'",
        "keep_fields": [
            "report_date_as_yyyy_mm_dd",
            "contract_market_name",
            "lev_money_positions_long",
            "lev_money_positions_short",
            "open_interest_all",
        ],
        "freq": "W",
        "units": "Count",
        "note": "CFTC TFF: Leveraged-money long/short positions in 10Y UST note futures.",
    },
    "tff_ust_2y_lev_money": {
        "resource_id": "gpe5-46if",
        "where": "contract_market_name = 'UST 2Y NOTE'",
        "keep_fields": [
            "report_date_as_yyyy_mm_dd",
            "contract_market_name",
            "lev_money_positions_long",
            "lev_money_positions_short",
            "open_interest_all",
        ],
        "freq": "W",
        "units": "Count",
        "note": "CFTC TFF: Leveraged-money long/short positions in 2Y UST note futures.",
    },
    "tff_ust_bond_lev_money": {
        "resource_id": "gpe5-46if",
        "where": "contract_market_name = 'UST BOND'",
        "keep_fields": [
            "report_date_as_yyyy_mm_dd",
            "contract_market_name",
            "lev_money_positions_long",
            "lev_money_positions_short",
            "open_interest_all",
        ],
        "freq": "W",
        "units": "Count",
        "note": "CFTC TFF: Leveraged-money long/short positions in long-end UST bond futures.",
    },
}
