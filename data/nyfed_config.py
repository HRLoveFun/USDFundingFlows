"""
NY Fed Markets Data API endpoint catalog.

Free, no API key required.
Docs: https://markets.newyorkfed.org/static/docs/markets-api.html
"""

NYFED_BASE = "https://markets.newyorkfed.org/api"

# `response_keys` lists the candidate top-level keys in NY Fed responses
# (the API uses different envelopes per endpoint family).
NYFED_ENDPOINTS = {
    "sofr": {
        "path": "/rates/secured/sofr/search.json",
        "params": {"startDate": "2018-04-02"},
        "freq": "D",
        "response_keys": ["refRates"],
        "fields_keep": [
            "effectiveDate", "percentRate",
            "percentPercentile1", "percentPercentile25",
            "percentPercentile75", "percentPercentile99",
            "volumeInBillions",
        ],
        "date_field": "effectiveDate",
    },
    "effr": {
        "path": "/rates/unsecured/effr/search.json",
        "params": {"startDate": "2013-01-01"},
        "freq": "D",
        "response_keys": ["refRates"],
        "fields_keep": [
            "effectiveDate", "percentRate",
            "percentPercentile1", "percentPercentile99",
            "volumeInBillions",
        ],
        "date_field": "effectiveDate",
    },
    "rrp_ops": {
        "path": "/rp/reverserepo/propositions/search.json",
        "params": {"startDate": "2013-01-01"},
        "freq": "D",
        "response_keys": ["repo", "operations"],
        "fields_keep": [
            "operationDate", "totalAmtAccepted",
            "totalAmtSubmitted", "acceptedCounterparties",
        ],
        "date_field": "operationDate",
    },
    "srf_ops": {
        # Standing Repo Facility — the public Markets API only exposes
        # `/rp/repo/all/results/last/N.json` (search/propositions both 400).
        # N=500 is the practical cap; SRF is sparsely used so this covers
        # all material activity to date.
        "path": "/rp/repo/all/results/last/500.json",
        "params": {},
        "freq": "D",
        "response_keys": ["repo", "operations"],
        "fields_keep": [
            "operationDate", "totalAmtAccepted",
            "totalAmtSubmitted", "operationType", "term",
        ],
        "date_field": "operationDate",
    },
    "soma_summary": {
        "path": "/soma/summary.json",
        "params": {},
        "freq": "W",
        "response_keys": ["soma", "summary"],
        "fields_keep": [
            "asOfDate", "total", "bills", "notesbonds",
            "tips", "frn", "mbs", "cmbs", "agencies",
        ],
        "date_field": "asOfDate",
    },
}
