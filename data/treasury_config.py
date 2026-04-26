"""
Treasury Fiscal Data API endpoint catalog.

Free, no API key required. JSON over REST.
Docs: https://fiscaldata.treasury.gov/api-documentation/
"""

TREASURY_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"

TREASURY_ENDPOINTS = {
    "tga_daily": {
        "path": "/v1/accounting/dts/operating_cash_balance",
        "fields": ["record_date", "account_type", "close_today_bal"],
        "filter_template": "record_date:gte:{start_date}",
        "freq": "D",
        "label": "Treasury General Account — Daily Balance",
    },
    "auctions": {
        "path": "/v1/accounting/od/auctions_query",
        "fields": [
            "auction_date", "security_type", "security_term",
            "high_yield", "bid_to_cover_ratio", "total_accepted",
        ],
        "filter_template": "auction_date:gte:{start_date}",
        "freq": "irregular",
        "label": "Treasury Auctions",
    },
    # NOTE: `marketable_securities_outstanding` is referenced in the
    # implementation plan but the Fiscal Data API path returns 404 as of
    # 2026-04. Skipping that endpoint; v2 export is non-blocking on it.
}
