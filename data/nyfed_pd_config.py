"""
NY Fed Primary Dealer Statistics (Markets Data API) endpoint catalog.

Public JSON, no auth.
Endpoint pattern: https://markets.newyorkfed.org/api/pd/get/<keyid>.json

`keyid` catalog: GET /api/pd/list/timeseries.json (returns ~hundreds of series).

Output convention: a per-series file
   data/raw/nyfed_pd/<alias>.json
each containing { keyid, freq, units, observations: {YYYY-MM-DD: value, ...} }.
"""

NYFED_PD_BASE = "https://markets.newyorkfed.org/api"

# alias -> { keyid, freq (W = weekly), units }
NYFED_PD_SERIES = {
    # Total dealer position in U.S. Treasury securities (excl. TIPS). The
    # canonical scale of the dealer book on the cash leg of the UST market.
    "primary_dealer_ust_position": {
        "keyid": "PDPOSGST-TOT",
        "freq": "W",
        "units": "Mil. USD",
        "note": "Primary Dealer Statistics: Total UST securities (excl. TIPS), net dealer position.",
    },
    # Federal Agency + GSE securities (excl. MBS) net position.
    "primary_dealer_agency_position": {
        "keyid": "PDPOSFGS-TOT",
        "freq": "W",
        "units": "Mil. USD",
        "note": "Primary Dealer Statistics: Federal agency + GSE securities (excl. MBS) net position.",
    },
    # MBS dealer book scale.
    "primary_dealer_mbs_position": {
        "keyid": "PDPOSMBS-TOT",
        "freq": "W",
        "units": "Mil. USD",
        "note": "Primary Dealer Statistics: Federal agency + GSE MBS net position.",
    },
}
