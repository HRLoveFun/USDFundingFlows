"""
OFR (Office of Financial Research) REST API endpoint catalog.

Free, no auth required for the timeseries API (the older v1/metadata catalog
needs a key, but the dataset/timeseries endpoints are open). If
`OFR_API_KEY` is set in the env, it is forwarded as a query param for any
endpoint that may require it; missing key is fail-soft (skip those).

Docs: https://www.financialresearch.gov/data/   (REST under
       https://data.financialresearch.gov/v1/)

Each entry maps a short *local* alias (the proxy_id used in the v2 registry)
to a real OFR mnemonic + frequency + units + a one-line provenance note.
"""

OFR_BASE = "https://data.financialresearch.gov/v1"

# alias -> { mnemonic, dataset, freq, units, note }
OFR_SERIES = {
    # --- Money Market Fund Monitor (monthly, since 2010-11) ---
    "ofr_mmf_total": {
        "mnemonic": "MMF-MMF_TOT-M",
        "dataset": "mmf",
        "freq": "M",
        "units": "USD",  # raw is dollars; downstream converts to Bil. USD
        "note": "OFR MMF Monitor: total MMF AUM (all categories).",
    },
    "ofr_mmf_treasury_repo_total": {
        # T_TOT = Treasury-collateralized repo holdings across the MMF
        # complex. Government MMFs dominate this bucket, so this is a usable
        # portfolio-side proxy for Government MMF scale.
        "mnemonic": "MMF-MMF_T_TOT-M",
        "dataset": "mmf",
        "freq": "M",
        "units": "USD",
        "note": "OFR MMF Monitor: Treasury-collateralized repo holdings (gov MMF dominant).",
    },
    "ofr_mmf_other_assets_total": {
        # OA_TOT = Non-Treasury repo holdings; Prime + Tax-Exempt funds
        # dominate this category.
        "mnemonic": "MMF-MMF_OA_TOT-M",
        "dataset": "mmf",
        "freq": "M",
        "units": "USD",
        "note": "OFR MMF Monitor: non-Treasury repo holdings (prime/tax-exempt MMF dominant).",
    },

    # --- Repo Markets Monitor (daily, since 2018-05) ---
    "ofr_repo_dvp_overnight_volume": {
        # DVP_OV_OO-P = DVP repo, overnight, outstanding volume,
        # preliminary. Sponsored cleared repo (FICC) appears in this stream
        # and is the canonical leverage indicator for hedge-fund basis trades.
        "mnemonic": "REPO-DVP_OV_OO-P",
        "dataset": "repo",
        "freq": "D",
        "units": "USD",
        "note": "OFR Repo Monitor: DVP overnight outstanding repo volume (HF basis-trade proxy).",
    },
    "ofr_repo_triparty_overnight_volume": {
        "mnemonic": "REPO-TRI_TV_OO-P",
        "dataset": "repo",
        "freq": "D",
        "units": "USD",
        "note": "OFR Repo Monitor: Tri-party overnight repo transaction volume.",
    },
}
