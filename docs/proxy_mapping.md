# Proxy Mapping — v2 Diagram

This document is the human-readable companion to
[`js/v2/proxy_registry.js`](../js/v2/proxy_registry.js). It lists every
node and edge in the v2 USD Funding Flows diagram together with the
data series chosen as its proxy, the theoretical rationale, and an
empirical anchor that should be re-validated periodically.

Status legend:

| Status      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `ok`        | Proxy comes from a public daily / weekly time series           |
| `partial`   | Proxy exists but requires manual extraction (CSV download etc.)|
| `external`  | Proxy lives outside any of the auto-pulled data sources         |
| `not_found` | No public time series — best to rely on a related edge instead |

Sources:

| Source     | Where it lives                                            |
| ---------- | --------------------------------------------------------- |
| `FRED`     | `data/json/time_series.json` (daily / weekly)              |
| `Derived`  | `data/json/pressure_indicators.json` (Module A)            |
| `NYFed`    | `data/json/nyfed_operations.json` (RRP / SRF / EFFR / SOFR) |
| `Treasury` | `data/json/treasury_flows.json` (TGA / auctions)            |
| `FedBS`    | `data/json/fed_balance_sheet.json` (H.4.1)                  |
| `External` | Out-of-band downloads (OFR, FHLB OF, FHFA, etc.)           |

---

## Node proxies

| Node ID                    | Display name                       | Primary proxy                       | Secondary proxy        | Status     | Theoretical anchor                                                                                                | Empirical anchor (suggested) |
| -------------------------- | ---------------------------------- | ----------------------------------- | ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `bs_reserve_balances`      | Reserve Balances                   | FRED · `WRESBAL`                    | FRED · `WALCL`         | ok         | Net Fed injection into banking system                                                                            | ρ(ΔWRESBAL, SOFR-IORB) ≈ -0.4 in QT |
| `bs_tga`                   | TGA                                | Treasury · `tga_balance_usd_m`      | FRED · `WTREGEN`       | ok         | TGA build = drain from private sector                                                                            | ρ(ΔTGA, ΔWRESBAL) ≈ -0.7~-0.9 |
| `bs_rrp`                   | Reverse Repurchase Agreements (parent) | FRED · `RPONTSYD`              | NYFed · `rrp_ops`      | ok         | ON RRP balance + counterparty count                                                                              | counterparty count leads usage by 1-2 months |
| `bs_rrp_omo`               | Open-market ON RRP                 | FRED · `RPONTSYD`                  | —                      | ok         | Same series as parent (foreign repo pool excluded)                                                               | matches headline RRP ≥ 99% of days |
| `bs_foreign_repo`          | Foreign repo pool                  | FRED · `WLRRAL`                     | —                      | ok         | Foreign repo pool sits inside total reverse repo liability                                                       | spread to RRPONTSYD = foreign pool size |
| `bs_primary_credit`        | Primary Credit Facility            | FRED · `WLCFLPCL`                   | —                      | ok         | Discount Window primary credit; stigma-suppressed                                                                | 2023-03 SVB week: jumped to $150B+ |
| `bs_cb_swaps`              | CB USD Liquidity Swaps             | FRED · `H41RESPPALDKNWW`            | —                      | ok         | Central-bank USD liquidity swaps                                                                                 | 2020-03, 2023-03 spikes |
| `bs_treasuries`            | Fed UST holdings                   | FRED · `TREAST`                     | —                      | ok         | QE/QT pace                                                                                                       | runoff cap aligns with tapering schedule |
| `bs_fed_notes`             | Currency in circulation            | FRED · `CURRCIR`                    | —                      | ok         | Slow-moving structural liability                                                                                 | trend growth ~5% YoY |
| `bs_other_liab`            | Other Liabilities (residual)       | —                                   | —                      | partial    | H.4.1 residual; no clean proxy                                                                                   | n/a |
| `bs_agency_mbs`            | Agency MBS                         | FRED · `MBST`                       | —                      | ok         | Fed agency MBS; QT runoff-cap-bound                                                                              | monthly $35B cap (2024) |
| `bs_foreign_reserves`      | Foreign Reserves                   | —                                   | —                      | partial    | Small, stable foreign-currency holdings                                                                          | n/a |
| `bs_others_assets`         | Other Assets (residual)            | —                                   | —                      | partial    | Residual asset bucket                                                                                            | n/a |
| `us_banks`                 | U.S. Banks                         | FRED · `TOTBKCR`                    | —                      | ok         | H.8 total bank credit                                                                                            | deposit outflow → wholesale dependence |
| `us_fbo`                   | U.S. Branches of Foreign Banks     | FRED · `H8B1058NCBCMG`              | —                      | ok         | FBOs rely on FX swap + IORB arbitrage                                                                            | ON RRP marginal players |
| `dealers`                  | Dealers                            | NYFed · primary-dealer stats        | —                      | partial    | Net UST coupon position = SLR capacity proxy                                                                     | manual download from NY Fed |
| `retail_investors`         | Retail Investors                   | —                                   | —                      | partial    | ICI weekly money funds + Z.1 closest                                                                             | n/a |
| `gov_mmf`                  | Government MMF                     | OFR · MMF Govt AUM                  | FRED · `MMMFFAQ027S`   | partial    | Govt MMF AUM ρ>0.85 with ON RRP balance (2021-2023)                                                              | OFR monthly download |
| `prime_mmf`                | Prime MMF                          | OFR · MMF Prime AUM                 | —                      | partial    | Dominant CP / Eurodollar buyer                                                                                   | OFR monthly download |
| `securities_lenders`       | Securities Lenders                 | NYFed · `soma_summary.seclending`   | —                      | partial    | Cash-vs-collateral imbalance                                                                                     | SOMA SecLending operations |
| `corporates_onshore`       | Onshore Corporates                 | FRED · `COMPAPER`                   | —                      | ok         | Non-financial CP outstanding                                                                                     | DCPN30-OIS inverts during stress |
| `fcb_swf_supra_onshore`    | FCBs / SWFs / Supras (onshore)     | FRED · `WLRRAL`                     | —                      | ok         | Foreign repo pool — offshore USD reservoir                                                                       | tracks G7 reserve managers |
| `hedge_funds`              | Hedge Funds & Other Managers       | OFR · sponsored cleared repo        | CFTC · TFF UST net short | partial  | Cash-futures basis trade dominant marginal UST buyer post-2021                                                    | OFR weekly download |
| `fhlb`                     | FHLBs                              | FHLB OF · monthly debt issuance     | —                      | external   | Largest single source in unsecured money markets                                                                 | 2019-09 reserve drawdown triggered repo spike |
| `gse`                      | Fannie / Freddie / GSEs            | FHFA · monthly GSE holdings         | —                      | external   | Non-IORB-eligible discount sellers in fed funds                                                                  | drives EFFR-IORB spread direction |
| `us_treasury`              | U.S. Treasury                      | Treasury · `tga_balance_usd_m`      | Treasury · `auctions_btc_by_term` | ok | TGA + auction stop-out + bid-to-cover                                                                            | issuance cadence |
| `fcb_swf_supra_offshore`   | FCBs / SWFs / Supras (offshore)    | FRED · `WLRRAL`                     | —                      | ok         | Same foreign repo pool as onshore mirror                                                                          | tracks G7 reserve managers |
| `foreign_insurers`         | Foreign Insurers                   | —                                   | —                      | not_found  | NAIC quarterly statutory filings closest indirect proxy                                                          | n/a |
| `foreign_banks`            | Foreign Banks                      | FRED · `H8B1058NCBCMG`              | —                      | ok         | Same series as `us_fbo` — FBO USD liability footprint                                                            | tracks Eurodollar deposits indirectly |
| `corporates_offshore`      | Offshore Corporates                | —                                   | —                      | not_found  | Offshore-USD corporate cash management is not publicly disclosed                                                  | n/a |
| `offshore_mmf`             | Offshore MMF                       | —                                   | —                      | partial    | ICI offshore MMF snapshots exist, but not as time series                                                          | n/a |

---

## Edge proxies (keyed by `transaction_type`)

| Transaction type     | Volume proxy                              | Price proxy                       | Status   | Theoretical anchor                                                                          |
| -------------------- | ----------------------------------------- | --------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `fed_funds`          | NYFed `effr.volume`                        | Derived `effr_iorb_spread_bps`    | ok       | Spread is the signal (volume small, $70-120B); < -10bp suggests GSE pressure                |
| `triparty_repo`      | OFR triparty volume                        | Derived `tgcr_iorb_spread_bps`    | partial  | $4-5T daily; persistent TGCR > IORB → strong reserve demand                                 |
| `bilateral_repo`     | OFR cleared bilateral repo                  | Derived `bgcr_tgcr_spread_bps`    | partial  | Bilateral spread widening → dealer balance sheet tight                                       |
| `sponsored_repo`     | OFR cleared sponsored repo                 | Derived `sofr_p99_median_gap_bps` | partial  | Sponsored volume = HF leverage; 99th-pct jumps foreshadow tail stress                        |
| `on_rrp`             | FRED `RRPONTSYD`                            | Derived `rrp_tbill4w_spread_bps`  | ok       | Positive spread → MMF parks at RRP; counterparty count leads usage 1-2 months                 |
| `srf`                | NYFed `srf_ops.totalAmtAccepted`            | Derived `srf_sofr_p99_gap_bps`    | ok       | Normally zero; any non-zero use is a danger signal (2024-09-30, 2024-12-31)                   |
| `discount_window`    | FRED `WLCFLPCL`                             | Derived `pcr_iorb_spread_bps`     | ok       | Stigma-suppressed; spiked $150B+ in 2023-03 SVB week                                          |
| `commercial_paper`   | FRED `COMPAPER`                             | FRED `DCPF1M`                     | ok       | DCPF1M-OIS > 50bp marks corporate short-funding stress                                        |
| `fx_swaps`           | FRED `H41RESPPALDKNWW`                      | External EUR-USD 3M basis         | partial  | FX basis < -50bp = offshore stress; led SOFR in 2020-03, 2022-09, 2023-03                     |
| `treasury_issuance`  | Treasury `auctions_btc_by_term.total_accepted` | Treasury `auctions_btc_by_term.high_yield` | ok | T-bill stop-out − ON RRP rate is the fundamental driver of RRP balance direction              |
| `iorb_corridor`      | FRED `WRESBAL`                              | FRED `IORB`                       | ok       | IORB and ON RRP rate form the corridor; floor = excess liquidity, cap = tight liquidity       |
| `eurodollar`         | —                                          | —                                 | not_found| Post-LIBOR (2023-06) no daily offshore-USD volume; BIS LBS quarterly; fall back to FX basis    |

---

## Maintenance notes

- When adding a new node or edge, update **both** `proxy_registry.js`
  and the corresponding row in this table. The registry is the
  source-of-truth; this file is the reviewer-friendly mirror.
- When a `partial` proxy graduates to a public daily/weekly series,
  flip its `proxy_status` to `ok` and remove the manual-download note.
- For a `not_found` row, prefer adding a fallback edge (see the
  `eurodollar → fx_swaps` example) rather than fabricating a proxy.
