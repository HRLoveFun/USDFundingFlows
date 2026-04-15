"""
Authoritative mapping of FRED series IDs to chart elements.
Each entry maps a series_id to its metadata: name, units, frequency,
associated transaction_type(s), and node_id(s).
"""

# ── Transaction Type definitions (10 types from NY Fed original) ──────────
TRANSACTION_TYPES = [
    {"id": "commercial_paper",   "name": "Commercial paper"},
    {"id": "eurodollar",         "name": "Eurodollar lending"},
    {"id": "fhlb_advances",      "name": "Federal Home Loan Bank advances"},
    {"id": "fed_funds",          "name": "Fed funds lending"},
    {"id": "reserve_deposits",   "name": "Fed reserve account deposits"},
    {"id": "fx_swaps",           "name": "Foreign exchange swaps"},
    {"id": "on_rrp",             "name": "Reverse repurchase agreement facility usage"},
    {"id": "securities",         "name": "Securities purchases from Treasury and GSEs"},
    {"id": "usd_deposits",       "name": "U.S. dollar deposits"},
    {"id": "repo",               "name": "U.S. dollar repo investments"},
]

# ── FRED Series definitions ───────────────────────────────────────────────
# units: "Bil. USD", "Rate (%)", "Bil. USD/day", "Mil. USD", etc.
# frequency: "D" (daily), "W" (weekly), "M" (monthly), "Q" (quarterly)

FRED_SERIES = {
    # ── #1 Commercial Paper ──────────────────────────────────────────────
    "COMPOUT": {
        "name": "Commercial Paper Outstanding (Total)",
        "units": "Bil. USD",
        "frequency": "W",
        "transaction_type": "commercial_paper",
        "node_ids": ["us_banks", "corporates", "prime_mmf"],
    },
    "FINCP": {
        "name": "Financial Commercial Paper Outstanding",
        "units": "Bil. USD",
        "frequency": "W",
        "transaction_type": "commercial_paper",
        "node_ids": ["us_banks", "prime_mmf"],
    },
    "COMPAPER": {
        "name": "Nonfinancial Commercial Paper Outstanding",
        "units": "Bil. USD",
        "frequency": "W",
        "transaction_type": "commercial_paper",
        "node_ids": ["corporates", "prime_mmf"],
    },
    "BOGZ1FL633030000Q": {
        "name": "MMF Time/Savings Deposits (incl. CDs)",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": ["commercial_paper", "usd_deposits"],
        "node_ids": ["prime_mmf", "us_banks"],
    },

    # ── #2 Eurodollar Lending ────────────────────────────────────────────
    "OBFRVOL": {
        "name": "Overnight Bank Funding Volume",
        "units": "Bil. USD",
        "frequency": "D",
        "transaction_type": ["eurodollar", "fed_funds", "usd_deposits"],
        "node_ids": ["fbo", "us_banks"],
    },
    "IR3TED01USM156N": {
        "name": "3-Month Eurodollar Deposit Rate",
        "units": "Rate (%)",
        "frequency": "M",
        "transaction_type": "eurodollar",
        "node_ids": ["fbo", "fcb_supra_swf"],
    },

    # ── #3 FHLB Advances ────────────────────────────────────────────────
    "BOGZ1FL403069330Q": {
        "name": "FHLB Advances Outstanding",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "fhlb_advances",
        "node_ids": ["fhlb", "us_banks"],
    },

    # ── #4 Fed Funds Lending ─────────────────────────────────────────────
    "EFFR": {
        "name": "Effective Federal Funds Rate",
        "units": "Rate (%)",
        "frequency": "D",
        "transaction_type": "fed_funds",
        "node_ids": ["fhlb", "gse", "us_banks", "fbo"],
    },
    "DFF": {
        "name": "Federal Funds Effective Rate (Daily)",
        "units": "Rate (%)",
        "frequency": "D",
        "transaction_type": "fed_funds",
        "node_ids": ["fhlb", "gse", "us_banks", "fbo"],
    },
    "EFFRVOL": {
        "name": "Federal Funds Volume",
        "units": "Bil. USD",
        "frequency": "D",
        "transaction_type": "fed_funds",
        "node_ids": ["fhlb", "gse", "us_banks", "fbo"],
    },

    # ── #5 Fed Reserve Account Deposits ──────────────────────────────────
    "WRESBAL": {
        "name": "Reserve Balances with Federal Reserve Banks",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "reserve_deposits",
        "node_ids": ["us_banks", "fbo", "federal_reserve"],
    },
    "IORB": {
        "name": "Interest on Reserve Balances Rate",
        "units": "Rate (%)",
        "frequency": "D",
        "transaction_type": "reserve_deposits",
        "node_ids": ["federal_reserve"],
    },
    "WDTGAL": {
        "name": "Treasury General Account",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "reserve_deposits",
        "node_ids": ["us_treasury", "federal_reserve"],
    },
    "WDFOA": {
        "name": "Foreign Official Deposits at Fed",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "reserve_deposits",
        "node_ids": ["fcb_supra_swf", "federal_reserve"],
    },
    "WLCFLPCL": {
        "name": "Primary Credit Loans (Discount Window)",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "reserve_deposits",
        "node_ids": ["us_banks", "federal_reserve"],
    },

    # ── #6 Foreign Exchange Swaps ────────────────────────────────────────
    "SWPT": {
        "name": "Central Bank Liquidity Swaps (Wed Level)",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "fx_swaps",
        "node_ids": ["federal_reserve", "fcb_supra_swf"],
    },
    "WCBLSA": {
        "name": "Central Bank Liquidity Swaps (Week Avg)",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "fx_swaps",
        "node_ids": ["federal_reserve", "fcb_supra_swf"],
    },
    "WSEFINTL1": {
        "name": "Fed Custody Holdings for Foreign Accounts",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "fx_swaps",
        "node_ids": ["fcb_supra_swf", "federal_reserve"],
    },
    "WMTSECL1": {
        "name": "Fed Custody Marketable Treasuries",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "fx_swaps",
        "node_ids": ["fcb_supra_swf", "federal_reserve"],
    },
    "FDHBFIN": {
        "name": "Federal Debt Held by Foreign/Intl Investors",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "fx_swaps",
        "node_ids": ["fcb_supra_swf"],
    },

    # ── #7 ON RRP Facility ───────────────────────────────────────────────
    "RRPONTTLD": {
        "name": "Overnight Reverse Repurchase Agreements (Total)",
        "units": "Bil. USD",
        "frequency": "D",
        "transaction_type": "on_rrp",
        "node_ids": ["federal_reserve", "gov_mmf", "gse", "broker_dealer"],
    },
    "WLRRAL": {
        "name": "Fed Reverse Repos (Wed Level)",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "on_rrp",
        "node_ids": ["federal_reserve"],
    },
    "BOGZ1FL632051103Q": {
        "name": "MMF Repos with Fed (ON RRP)",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "on_rrp",
        "node_ids": ["gov_mmf", "federal_reserve"],
    },

    # ── #8 Securities Purchases ──────────────────────────────────────────
    "TREAST": {
        "name": "Fed Holdings: Treasury Securities",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": "securities",
        "node_ids": ["federal_reserve", "us_treasury"],
    },
    "BOGZ1FL633061110Q": {
        "name": "MMF Treasury Bills",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["gov_mmf", "us_treasury"],
    },
    "BOGZ1FL633061105Q": {
        "name": "MMF Treasury Securities",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["gov_mmf", "us_treasury"],
    },
    "GFDEBTN": {
        "name": "Federal Debt: Total Public Debt",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["us_treasury"],
    },
    "BOGZ1FL403065015Q": {
        "name": "Fannie Mae Mortgages Held",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["gse"],
    },
    "BOGZ1FL403065025Q": {
        "name": "Freddie Mac Mortgages Held",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["gse"],
    },
    "BOGZ1FL404090423Q": {
        "name": "Freddie Mac Total Assets",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "securities",
        "node_ids": ["gse"],
    },

    # ── #9 U.S. Dollar Deposits ──────────────────────────────────────────
    "DPSFRIM027SBOG": {
        "name": "Deposits at Foreign-Related Institutions",
        "units": "Bil. USD",
        "frequency": "M",
        "transaction_type": "usd_deposits",
        "node_ids": ["fbo", "fcb_supra_swf"],
    },
    "FBOUSIBFDFBA": {
        "name": "FBO Deposits at Foreign Banks",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "usd_deposits",
        "node_ids": ["fbo"],
    },

    # ── #10 U.S. Dollar Repo Investments ─────────────────────────────────
    "SOFR": {
        "name": "Secured Overnight Financing Rate",
        "units": "Rate (%)",
        "frequency": "D",
        "transaction_type": "repo",
        "node_ids": ["gov_mmf", "prime_mmf", "broker_dealer"],
    },
    "SOFRVOL": {
        "name": "SOFR Volume",
        "units": "Bil. USD",
        "frequency": "D",
        "transaction_type": "repo",
        "node_ids": ["gov_mmf", "prime_mmf", "broker_dealer"],
    },
    "RPONTSYD": {
        "name": "Fed Repo Operations: Treasury Securities",
        "units": "Bil. USD",
        "frequency": "D",
        "transaction_type": "repo",
        "node_ids": ["federal_reserve", "broker_dealer"],
    },
    "BOGZ1FL632051000Q": {
        "name": "MMF Total Repo Assets",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "repo",
        "node_ids": ["gov_mmf", "prime_mmf", "broker_dealer"],
    },
    "BOGZ1FL662151003Q": {
        "name": "Broker-Dealer Repo Liabilities",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "repo",
        "node_ids": ["broker_dealer"],
    },
    "BOGZ1FL622051003Q": {
        "name": "Hedge Fund Repo Assets",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "repo",
        "node_ids": ["hedge_fund", "broker_dealer"],
    },
    "BOGZ1FL664090663Q": {
        "name": "Broker-Dealer Total Assets",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": "repo",
        "node_ids": ["broker_dealer"],
    },
    "DPCREDIT": {
        "name": "Discount Window Primary Credit Rate",
        "units": "Rate (%)",
        "frequency": "D",
        "transaction_type": "repo",
        "node_ids": ["federal_reserve", "us_banks"],
    },

    # ── Node-level aggregate metrics ─────────────────────────────────────
    "WALCL": {
        "name": "Federal Reserve Total Assets",
        "units": "Mil. USD",
        "frequency": "W",
        "transaction_type": None,
        "node_ids": ["federal_reserve"],
    },
    "MMMFFAQ027S": {
        "name": "Total Money Market Fund Assets",
        "units": "Bil. USD",
        "frequency": "M",
        "transaction_type": None,
        "node_ids": ["gov_mmf", "prime_mmf"],
    },
    "BOGZ1FL634090033Q": {
        "name": "Government MMF Total Assets",
        "units": "Mil. USD",
        "frequency": "Q",
        "transaction_type": None,
        "node_ids": ["gov_mmf"],
    },
}
