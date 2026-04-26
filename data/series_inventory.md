# Series Inventory — USD Funding Flows v2

> Produced under IEF Phase 1 (Data Inventory). Authoritative list of time series consumed by the project.
> Frequency codes: D = daily, W = weekly, M = monthly, Q = quarterly.
> Reproducibility: every row has a runnable fetch path.

## Conventions

- **Source priority** (per spec §Constraints): FRED → NY Fed → Treasury. Cross-source duplicates are still listed under each source so that downstream `cross_source_diff.py` can reconcile them.
- **Fetch method**: `fredapi` for FRED, `requests` for NY Fed Markets API and Treasury Fiscal Data API.
- **Reproducibility command** is shown once per source section. It is a smoke command, not a full DB rebuild (use `data/build_database.py` for that).
- **Node IDs** below are v2 node IDs from `js/v2/constants.js` (frozen — `spec.md` Q1).

---

## §FRED — Federal Reserve Economic Data (52 series total: 43 v1 + 9 v2 additions)

**Authoritative source**: `data/series_config.py` (`FRED_SERIES` + `FRED_SERIES_V2`).
**Fetch script**: `data/fetch_fred_data.py` (writes `data/json/raw_observations.json` and `…_v2.json`).
**Credential**: `FRED_API_KEY` in `.env` (free — register at https://fred.stlouisfed.org/docs/api/api_key.html).
**Smoke command** (verifies key + endpoint, fetches a single fast series):
```bash
python3 -c "
import os, sys; sys.path.insert(0,'data')
from dotenv import load_dotenv; load_dotenv('.env')
from fredapi import Fred
s = Fred(api_key=os.getenv('FRED_API_KEY')).get_series('EFFR', observation_start='2024-01-01')
print(f'EFFR ok: {len(s)} obs, last={s.index[-1].date()}={s.iloc[-1]}')
"
```
**Full refresh** (fetches all 52 series; ~35 s at 0.6 s rate limit):
```bash
cd data && python3 fetch_fred_data.py
```

### §FRED.1 — v1 series (43 entries, fed by `FRED_SERIES`)

| 来源 | 名称 (Series Name) | 标识 (Series ID) | 频率 | 单位 | Transaction Type | v2 Node IDs | 获取方式 | 脚本路径 |
|---|---|---|---|---|---|---|---|---|
| FRED | Commercial Paper Outstanding (Total) | `COMPOUT` | W | Bil. USD | commercial_paper | us_banks, corporates, prime_mmf | `fredapi.Fred.get_series('COMPOUT', start='2013-01-01')` | `data/fetch_fred_data.py` |
| FRED | Financial Commercial Paper Outstanding | `FINCP` | W | Bil. USD | commercial_paper | us_banks, prime_mmf | `fredapi.Fred.get_series('FINCP', …)` | `data/fetch_fred_data.py` |
| FRED | Nonfinancial Commercial Paper Outstanding | `COMPAPER` | W | Bil. USD | commercial_paper | corporates, prime_mmf | `fredapi.Fred.get_series('COMPAPER', …)` | `data/fetch_fred_data.py` |
| FRED | MMF Time/Savings Deposits (incl. CDs) | `BOGZ1FL633030000Q` | Q | Mil. USD | commercial_paper, usd_deposits | prime_mmf, us_banks | `fredapi.Fred.get_series('BOGZ1FL633030000Q', …)` | `data/fetch_fred_data.py` |
| FRED | Overnight Bank Funding Volume | `OBFRVOL` | D | Bil. USD | eurodollar, fed_funds, usd_deposits | fbo, us_banks | `fredapi.Fred.get_series('OBFRVOL', …)` | `data/fetch_fred_data.py` |
| FRED | 3-Month Eurodollar Deposit Rate | `IR3TED01USM156N` | M | Rate (%) | eurodollar | fbo, fcb_supra_swf | `fredapi.Fred.get_series('IR3TED01USM156N', …)` | `data/fetch_fred_data.py` |
| FRED | FHLB Advances Outstanding | `BOGZ1FL403069330Q` | Q | Mil. USD | fhlb_advances | fhlb, us_banks | `fredapi.Fred.get_series('BOGZ1FL403069330Q', …)` | `data/fetch_fred_data.py` |
| FRED | Effective Federal Funds Rate | `EFFR` | D | Rate (%) | fed_funds | fhlb, gse, us_banks, fbo | `fredapi.Fred.get_series('EFFR', …)` | `data/fetch_fred_data.py` |
| FRED | Federal Funds Effective Rate (Daily) | `DFF` | D | Rate (%) | fed_funds | fhlb, gse, us_banks, fbo | `fredapi.Fred.get_series('DFF', …)` | `data/fetch_fred_data.py` |
| FRED | Federal Funds Volume | `EFFRVOL` | D | Bil. USD | fed_funds | fhlb, gse, us_banks, fbo | `fredapi.Fred.get_series('EFFRVOL', …)` | `data/fetch_fred_data.py` |
| FRED | Reserve Balances with Federal Reserve Banks | `WRESBAL` | W | Mil. USD | reserve_deposits | us_banks, fbo, federal_reserve | `fredapi.Fred.get_series('WRESBAL', …)` | `data/fetch_fred_data.py` |
| FRED | Interest on Reserve Balances Rate | `IORB` | D | Rate (%) | reserve_deposits | federal_reserve | `fredapi.Fred.get_series('IORB', …)` | `data/fetch_fred_data.py` |
| FRED | Treasury General Account | `WDTGAL` | W | Mil. USD | reserve_deposits | us_treasury, federal_reserve | `fredapi.Fred.get_series('WDTGAL', …)` | `data/fetch_fred_data.py` |
| FRED | Foreign Official Deposits at Fed | `WDFOA` | W | Mil. USD | reserve_deposits | fcb_supra_swf, federal_reserve | `fredapi.Fred.get_series('WDFOA', …)` | `data/fetch_fred_data.py` |
| FRED | Primary Credit Loans (Discount Window) | `WLCFLPCL` | W | Mil. USD | reserve_deposits | us_banks, federal_reserve | `fredapi.Fred.get_series('WLCFLPCL', …)` | `data/fetch_fred_data.py` |
| FRED | Central Bank Liquidity Swaps (Wed Level) | `SWPT` | W | Mil. USD | fx_swaps | federal_reserve, fcb_supra_swf | `fredapi.Fred.get_series('SWPT', …)` | `data/fetch_fred_data.py` |
| FRED | Central Bank Liquidity Swaps (Week Avg) | `WCBLSA` | W | Mil. USD | fx_swaps | federal_reserve, fcb_supra_swf | `fredapi.Fred.get_series('WCBLSA', …)` | `data/fetch_fred_data.py` |
| FRED | Fed Custody Holdings for Foreign Accounts | `WSEFINTL1` | W | Mil. USD | fx_swaps | fcb_supra_swf, federal_reserve | `fredapi.Fred.get_series('WSEFINTL1', …)` | `data/fetch_fred_data.py` |
| FRED | Fed Custody Marketable Treasuries | `WMTSECL1` | W | Mil. USD | fx_swaps | fcb_supra_swf, federal_reserve | `fredapi.Fred.get_series('WMTSECL1', …)` | `data/fetch_fred_data.py` |
| FRED | Federal Debt Held by Foreign/Intl Investors | `FDHBFIN` | Q | Mil. USD | fx_swaps | fcb_supra_swf | `fredapi.Fred.get_series('FDHBFIN', …)` | `data/fetch_fred_data.py` |
| FRED | Overnight Reverse Repurchase Agreements (Total) | `RRPONTTLD` | D | Bil. USD | on_rrp | federal_reserve, gov_mmf, gse, broker_dealer | `fredapi.Fred.get_series('RRPONTTLD', …)` | `data/fetch_fred_data.py` |
| FRED | Fed Reverse Repos (Wed Level) | `WLRRAL` | W | Mil. USD | on_rrp | federal_reserve | `fredapi.Fred.get_series('WLRRAL', …)` | `data/fetch_fred_data.py` |
| FRED | MMF Repos with Fed (ON RRP) | `BOGZ1FL632051103Q` | Q | Mil. USD | on_rrp | gov_mmf, federal_reserve | `fredapi.Fred.get_series('BOGZ1FL632051103Q', …)` | `data/fetch_fred_data.py` |
| FRED | Fed Holdings: Treasury Securities | `TREAST` | W | Mil. USD | securities | federal_reserve, us_treasury | `fredapi.Fred.get_series('TREAST', …)` | `data/fetch_fred_data.py` |
| FRED | MMF Treasury Bills | `BOGZ1FL633061110Q` | Q | Mil. USD | securities | gov_mmf, us_treasury | `fredapi.Fred.get_series('BOGZ1FL633061110Q', …)` | `data/fetch_fred_data.py` |
| FRED | MMF Treasury Securities | `BOGZ1FL633061105Q` | Q | Mil. USD | securities | gov_mmf, us_treasury | `fredapi.Fred.get_series('BOGZ1FL633061105Q', …)` | `data/fetch_fred_data.py` |
| FRED | Federal Debt: Total Public Debt | `GFDEBTN` | Q | Mil. USD | securities | us_treasury | `fredapi.Fred.get_series('GFDEBTN', …)` | `data/fetch_fred_data.py` |
| FRED | Fannie Mae Mortgages Held | `BOGZ1FL403065015Q` | Q | Mil. USD | securities | gse | `fredapi.Fred.get_series('BOGZ1FL403065015Q', …)` | `data/fetch_fred_data.py` |
| FRED | Freddie Mac Mortgages Held | `BOGZ1FL403065025Q` | Q | Mil. USD | securities | gse | `fredapi.Fred.get_series('BOGZ1FL403065025Q', …)` | `data/fetch_fred_data.py` |
| FRED | Freddie Mac Total Assets | `BOGZ1FL404090423Q` | Q | Mil. USD | securities | gse | `fredapi.Fred.get_series('BOGZ1FL404090423Q', …)` | `data/fetch_fred_data.py` |
| FRED | Deposits at Foreign-Related Institutions | `DPSFRIM027SBOG` | M | Bil. USD | usd_deposits | fbo, fcb_supra_swf | `fredapi.Fred.get_series('DPSFRIM027SBOG', …)` | `data/fetch_fred_data.py` |
| FRED | FBO Deposits at Foreign Banks | `FBOUSIBFDFBA` | Q | Mil. USD | usd_deposits | fbo | `fredapi.Fred.get_series('FBOUSIBFDFBA', …)` | `data/fetch_fred_data.py` |
| FRED | Secured Overnight Financing Rate | `SOFR` | D | Rate (%) | repo | gov_mmf, prime_mmf, broker_dealer | `fredapi.Fred.get_series('SOFR', …)` | `data/fetch_fred_data.py` |
| FRED | SOFR Volume | `SOFRVOL` | D | Bil. USD | repo | gov_mmf, prime_mmf, broker_dealer | `fredapi.Fred.get_series('SOFRVOL', …)` | `data/fetch_fred_data.py` |
| FRED | Fed Repo Operations: Treasury Securities | `RPONTSYD` | D | Bil. USD | repo | federal_reserve, broker_dealer | `fredapi.Fred.get_series('RPONTSYD', …)` | `data/fetch_fred_data.py` |
| FRED | MMF Total Repo Assets | `BOGZ1FL632051000Q` | Q | Mil. USD | repo | gov_mmf, prime_mmf, broker_dealer | `fredapi.Fred.get_series('BOGZ1FL632051000Q', …)` | `data/fetch_fred_data.py` |
| FRED | Broker-Dealer Repo Liabilities | `BOGZ1FL662151003Q` | Q | Mil. USD | repo | broker_dealer | `fredapi.Fred.get_series('BOGZ1FL662151003Q', …)` | `data/fetch_fred_data.py` |
| FRED | Hedge Fund Repo Assets | `BOGZ1FL622051003Q` | Q | Mil. USD | repo | hedge_fund, broker_dealer | `fredapi.Fred.get_series('BOGZ1FL622051003Q', …)` | `data/fetch_fred_data.py` |
| FRED | Broker-Dealer Total Assets | `BOGZ1FL664090663Q` | Q | Mil. USD | repo | broker_dealer | `fredapi.Fred.get_series('BOGZ1FL664090663Q', …)` | `data/fetch_fred_data.py` |
| FRED | Discount Window Primary Credit Rate | `DPCREDIT` | D | Rate (%) | repo | federal_reserve, us_banks | `fredapi.Fred.get_series('DPCREDIT', …)` | `data/fetch_fred_data.py` |
| FRED | Federal Reserve Total Assets | `WALCL` | W | Mil. USD | (aggregate) | federal_reserve | `fredapi.Fred.get_series('WALCL', …)` | `data/fetch_fred_data.py` |
| FRED | Total Money Market Fund Assets | `MMMFFAQ027S` | M | Bil. USD | (aggregate) | gov_mmf, prime_mmf | `fredapi.Fred.get_series('MMMFFAQ027S', …)` | `data/fetch_fred_data.py` |
| FRED | Government MMF Total Assets | `BOGZ1FL634090033Q` | Q | Mil. USD | (aggregate) | gov_mmf | `fredapi.Fred.get_series('BOGZ1FL634090033Q', …)` | `data/fetch_fred_data.py` |

### §FRED.2 — v2 additions (9 entries, fed by `FRED_SERIES_V2`)

> Per `series_config.py` 注释，v2 series are kept in a separate dict so v1 JSON outputs stay byte-equivalent. Output: `data/json/raw_observations_v2.json`.

| 来源 | 名称 (Series Name) | 标识 (Series ID) | 频率 | 单位 | Group | v2 Node IDs | 获取方式 | 脚本路径 |
|---|---|---|---|---|---|---|---|---|
| FRED | TGA (Weekly, H.4.1) | `WTREGEN` | W | Mil. USD | fed_bs | us_treasury, federal_reserve | `fredapi.Fred.get_series('WTREGEN', …)` | `data/fetch_fred_data.py` |
| FRED | BTFP Outstanding (Other Credit Extensions) | `WLCFOCEL` | W | Mil. USD | fed_bs | us_banks, federal_reserve | `fredapi.Fred.get_series('WLCFOCEL', …)` | `data/fetch_fred_data.py` |
| FRED | Central Bank Liquidity Swaps (H.4.1 Wed) | `H41RESPPALDKNWW` | W | Mil. USD | fed_bs | federal_reserve, fcb_supra_swf | `fredapi.Fred.get_series('H41RESPPALDKNWW', …)` | `data/fetch_fred_data.py` |
| FRED | Overnight Bank Funding Rate | `OBFR` | D | Rate (%) | rates | us_banks, fbo | `fredapi.Fred.get_series('OBFR', …)` | `data/fetch_fred_data.py` |
| FRED | 1-Month Financial Commercial Paper Rate | `DCPF1M` | D | Rate (%) | cp | us_banks, prime_mmf | `fredapi.Fred.get_series('DCPF1M', …)` | `data/fetch_fred_data.py` |
| FRED | 1-Month Nonfinancial Commercial Paper Rate | `DCPN30` | D | Rate (%) | cp | corporates, prime_mmf | `fredapi.Fred.get_series('DCPN30', …)` | `data/fetch_fred_data.py` |
| FRED | Bank Credit, All Commercial Banks (H.8) | `TOTBKCR` | W | Bil. USD | bank | us_banks | `fredapi.Fred.get_series('TOTBKCR', …)` | `data/fetch_fred_data.py` |
| FRED | 4-Week Treasury Bill: Secondary Market Rate | `DTB4WK` | D | Rate (%) | treasury_rates | us_treasury | `fredapi.Fred.get_series('DTB4WK', …)` | `data/fetch_fred_data.py` |
| FRED | 3-Month Treasury Bill: Secondary Market Rate | `DTB3` | D | Rate (%) | treasury_rates | us_treasury | `fredapi.Fred.get_series('DTB3', …)` | `data/fetch_fred_data.py` |

### §FRED — Cross-source overlap notes

These FRED series have NY Fed equivalents that will be inventoried in S1.2; FRED is primary per `spec.md` Q7 (FRED → NY Fed → Treasury):

| FRED ID | NY Fed equivalent | Note |
|---|---|---|
| `EFFR` / `DFF` | NY Fed `rates/unsecured/effr` | NY Fed publishes T+0 (afternoon); FRED republishes T+1. |
| `OBFR` | NY Fed `rates/unsecured/obfr` | Same series. |
| `SOFR` / `SOFRVOL` | NY Fed `rates/secured/sofr` | NY Fed publishes T+0 ~08:00 ET; FRED republishes T+1. |
| `RRPONTTLD` | NY Fed `markets/desk-operations/reverse-repo` | NY Fed gives per-counterparty detail. |
| `TREAST` / `WALCL` | (Fed H.4.1 — same) | Sourced from H.4.1 directly. |

These overlaps are the primary triggers for the S2.5 `cross_source_diff.py` reconciliation table.

### §FRED — Smoke verification (run on this Step)

| Item | Result |
|---|---|
| Date | 2026-04-26 |
| `FRED_API_KEY` set | ✅ |
| `series_config.FRED_SERIES` count | 43 |
| `series_config.FRED_SERIES_V2` count | 9 |
| `fredapi.Fred.get_series('EFFR', start='2024-01-01')` | ✅ 604 obs, last=2026-04-23 = 3.64 |
| Cached `raw_observations.json` mtime | 2026-04-26 02:14 (875 KB) |
| Cached `raw_observations_v2.json` mtime | 2026-04-26 02:15 (391 KB) |

---

## §NYFed — Federal Reserve Bank of New York Markets API (5 endpoints)

**Authoritative source**: `data/nyfed_config.py` (`NYFED_ENDPOINTS`).
**Fetch script**: `data/fetch_nyfed_data.py` (writes `data/raw/nyfed/<endpoint>.json`).
**Credential**: none — public Markets API (`https://markets.newyorkfed.org/api`).
**Smoke command** (single endpoint, last 5 obs, no full pull):
```bash
python3 -c "
import requests
r = requests.get('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/5.json', timeout=30)
print('status:', r.status_code, 'rows:', len(r.json().get('refRates', [])))
"
```
**Full refresh** (all 5 endpoints; ~30 s):
```bash
cd data && python3 fetch_nyfed_data.py
```

### §NYFed.1 — Endpoint catalog

| 来源 | 名称 | 标识 (key) | API path | 频率 | 单位 | v2 Node IDs (inferred) | 获取方式 | 脚本路径 |
|---|---|---|---|---|---|---|---|---|
| NY Fed | Secured Overnight Financing Rate (incl. percentiles + volume) | `sofr` | `/rates/secured/sofr/search.json` | D | Rate (%) + Bil. USD | gov_mmf, prime_mmf, broker_dealer | `requests.get` w/ `startDate=2018-04-02` | `data/fetch_nyfed_data.py` |
| NY Fed | Effective Federal Funds Rate (incl. percentiles + volume) | `effr` | `/rates/unsecured/effr/search.json` | D | Rate (%) + Bil. USD | us_banks, fbo, fhlb, gse | `requests.get` w/ `startDate=2013-01-01` | `data/fetch_nyfed_data.py` |
| NY Fed | ON RRP Operation Propositions | `rrp_ops` | `/rp/reverserepo/propositions/search.json` | D | USD + counterparty count | federal_reserve, gov_mmf, gse, broker_dealer | `requests.get` w/ `startDate=2013-01-01` | `data/fetch_nyfed_data.py` |
| NY Fed | Standing Repo Facility Operation Results | `srf_ops` | `/rp/repo/all/results/last/500.json` | D (sparse) | USD + term | federal_reserve, broker_dealer, us_banks | `requests.get` (last 500 ops; search/propositions return 400) | `data/fetch_nyfed_data.py` |
| NY Fed | SOMA Holdings Summary (bills / notesbonds / TIPS / FRN / MBS / CMBS / agencies) | `soma_summary` | `/soma/summary.json` | W | Mil. USD | federal_reserve, us_treasury | `requests.get` (no params) | `data/fetch_nyfed_data.py` |

### §NYFed — Cross-source overlap with FRED (extends §FRED notes)

| NY Fed key | FRED equivalent(s) | Note |
|---|---|---|
| `effr` | `EFFR` / `DFF` / `EFFRVOL` | NY Fed publishes T+0 afternoon (~16:30 ET); FRED republishes T+1. NY Fed authoritative per Q7 fallback when FRED is stale; volumes match. |
| `sofr` | `SOFR` / `SOFRVOL` | NY Fed T+0 ~08:00 ET; FRED republishes T+1. NY Fed adds 1/25/75/99-pct percentiles which FRED does not expose — primary for percentile views. |
| `rrp_ops` | `RRPONTTLD` (Bil USD daily total) / `WLRRAL` (weekly Wed level) | FRED gives only the total; NY Fed adds counterparty count + submitted vs accepted gap. |
| `soma_summary` | `TREAST` (Treasury holdings) / `WALCL` (total Fed assets) | NY Fed breaks down by sub-portfolio (TIPS / FRN / MBS / CMBS / agencies) which FRED does not. |
| `srf_ops` | (no FRED equivalent) | NY Fed is sole public source. R005 watchlist: SRF history < 36 months is sparse — 2.2 must use partial-window fallback. |

> Per `spec.md` Q7 priority FRED → NY Fed → Treasury, FRED remains primary for `effr` / `sofr` / `rrp_ops` numeric levels; NY Fed becomes primary for percentile decomposition, counterparty count, SOMA sub-portfolio split, and SRF (which has no FRED equivalent). Final assignment is logged in P2.3, not here.

### §NYFed — Smoke verification (run on this Step)

| Item | Result |
|---|---|
| Date | 2026-04-26 |
| `requests.get('/rates/unsecured/effr/last/5.json')` | ✅ 200; sample row `effectiveDate=2026-04-23, percentRate=3.64, volumeInBillions=93` (matches FRED EFFR smoke) |
| Endpoint count | 5 (`sofr` / `effr` / `rrp_ops` / `srf_ops` / `soma_summary`) |
| `data/raw/nyfed/effr.json` | 462,981 bytes |
| `data/raw/nyfed/sofr.json` | 458,741 bytes |
| `data/raw/nyfed/rrp_ops.json` | 255,356 bytes |
| `data/raw/nyfed/srf_ops.json` | 78,871 bytes (sparse — confirms R005 partial-window concern) |
| `data/raw/nyfed/soma_summary.json` | 306,339 bytes |

---

## §Treasury — U.S. Treasury Fiscal Data API (2 endpoints)

**Authoritative source**: `data/treasury_config.py` (`TREASURY_ENDPOINTS`).
**Fetch script**: `data/fetch_treasury_data.py` (writes `data/raw/treasury/<endpoint>.json`; paginated, 10k rows/page).
**Credential**: none — public Fiscal Data API (`https://api.fiscaldata.treasury.gov/services/api/fiscal_service`).
**Smoke command** (single endpoint, 5 rows, no full pull):
```bash
python3 -c "
import requests
r = requests.get(
    'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance',
    params={'fields':'record_date,account_type,close_today_bal',
            'filter':'record_date:gte:2026-04-20',
            'page[size]':5, 'format':'json'},
    timeout=30,
)
print('status:', r.status_code, 'rows:', len(r.json().get('data', [])))
"
```
**Full refresh** (both endpoints, paginated; ~30 s):
```bash
cd data && python3 fetch_treasury_data.py
```

### §Treasury.1 — Endpoint catalog

| 来源 | 名称 | 标识 (key) | API path | 频率 | 字段 | v2 Node IDs (inferred) | 获取方式 | 脚本路径 |
|---|---|---|---|---|---|---|---|---|
| U.S. Treasury | TGA Daily Operating Cash Balance | `tga_daily` | `/v1/accounting/dts/operating_cash_balance` | D | `record_date`, `account_type`, `close_today_bal` | us_treasury, federal_reserve | paginated `requests.get` w/ `record_date:gte:2013-01-01` | `data/fetch_treasury_data.py` |
| U.S. Treasury | Treasury Auctions | `auctions` | `/v1/accounting/od/auctions_query` | irregular | `auction_date`, `security_type`, `security_term`, `high_yield`, `bid_to_cover_ratio`, `total_accepted` | us_treasury, broker_dealer | paginated `requests.get` w/ `auction_date:gte:2013-01-01` | `data/fetch_treasury_data.py` |

### §Treasury — Cross-source overlap with FRED (extends §FRED notes)

| Treasury key | FRED equivalent(s) | Note |
|---|---|---|
| `tga_daily` | `WTREGEN` (weekly H.4.1) / `WDTGAL` (weekly TGA) | Treasury source is **daily** vs FRED weekly. Per `spec.md` Q7, FRED is primary, but for daily-granularity views Treasury must be selected — log in P2.3 D-003. |
| `auctions` | (no FRED equivalent) | Treasury sole source for auction-level high yield / bid-to-cover; consumed by `us_treasury` node tooltip / time-series. |

### §Treasury — Known gap (per `treasury_config.py` comment)

`marketable_securities_outstanding` is referenced in `implementation_plan.md` but the Fiscal Data API path returns 404 as of 2026-04. Skipped; v2 export non-blocking. Tracked under R006 (external dependency); no new risk needed.

### §Treasury — Smoke verification (run on this Step)

| Item | Result |
|---|---|
| Date | 2026-04-26 |
| TGA daily smoke (`record_date:gte:2026-04-20`, page size 5) | ✅ 200; 5 rows |
| Endpoint count | 2 (`tga_daily` / `auctions`) |
| `data/raw/treasury/tga_daily.json` | 1,439,608 bytes |
| `data/raw/treasury/auctions.json` | 971,757 bytes |

## §Appendix — Whitelist sources (planning only — no data pulled in P1)

> Produced by S1.4. Lists the candidate non-FRED/NY Fed/Treasury sources required to fill gaps in `js/v2/proxy_registry.js` (entries flagged `proxy_status: "external" | "partial" | "not_found"` and edges with `source: "External"`). **No fetcher is implemented in this Step**; implementation lands in S2.4.
>
> Decision authority for the IN-scope set is `decisions.md` D-001 (this Step).

### §Appendix.1 — Gap inventory (from `js/v2/proxy_registry.js`)

**Node-side gaps:**

| Node ID | proxy_status | Current registry note | Candidate whitelist source |
|---|---|---|---|
| `dealers` | partial | NY Fed weekly Primary Dealer Statistics CSV (manual download) | NY Fed (extension) + SIFMA |
| `retail_investors` | partial | ICI weekly money funds + Fed Z.1 closest proxies | ICI + SEC (Z.1 already FRED-derivable) |
| `gov_mmf` | partial | External `ofr_mmf_govt_aum` (monthly) | OFR |
| `prime_mmf` | partial | External `ofr_mmf_prime_aum` (monthly) | OFR |
| `securities_lenders` | partial | NYFed `soma_summary` seclending metric | (already in §NYFed; no whitelist needed) |
| `hedge_funds` | partial | External `ofr_cleared_repo_sponsored` + `cftc_tff_treasury_net_short` | OFR + CFTC (proposed addition) |
| `fhlb` | external | External `fhlb_of_monthly` (FHLB Office of Finance) | FHLB-OF (proposed addition; not in spec whitelist but free public PDF/CSV) |
| `gse` | external | External `fhfa_gse_holdings` (FHFA monthly) | FHFA (proposed addition; not in spec whitelist but free public report) |
| `foreign_insurers` | not_found | NAIC quarterly statutory closest indirect | (defer — see §Appendix.4) |
| `corporates_offshore` | not_found | not publicly disclosed | (defer — see §Appendix.4) |
| `offshore_mmf` | partial | ICI offshore snapshots (not time series) | ICI (snapshot-only; partial coverage) |
| `bs_other_liab` / `bs_foreign_reserves` / `bs_others_assets` | partial | residual H.4.1 buckets | none — residuals stay partial |

**Edge-side gaps:**

| Edge `transaction_type` | proxy_status | Current registry note | Candidate whitelist source |
|---|---|---|---|
| `triparty_repo` | partial | External `ofr_triparty_volume` | OFR |
| `bilateral_repo` | partial | External `ofr_cleared_bilateral_repo` | OFR |
| `sponsored_repo` | partial | External `ofr_cleared_repo_sponsored` | OFR (or DTCC FICC if OFR data lags) |
| `fx_swaps` | partial | External `eur_usd_3m_basis` (Bloomberg / FRBNY G.5) | BIS USD basis tables (Bloomberg path is rejected — paid feed; spec Q9 forbids) |
| `eurodollar` | not_found | post-LIBOR no daily offshore volume | BIS LBS (quarterly, lagged — partial only) |

### §Appendix.2 — Per-source scoping table

| 来源 | 入选 (D-001) | Coverage (gap-filling) | 访问方式 | 凭证 (Q9 兼容) | 提议 fetcher 模块 | Inception risks |
|---|---|---|---|---|---|---|
| **OFR** (Office of Financial Research) | ✅ IN | `gov_mmf` / `prime_mmf` AUM (MMF Monitor) · `triparty_repo` 量 · `bilateral_repo` 量 · `sponsored_repo` 量 · `hedge_funds` (sponsored repo leg) | Public REST API + CSV (https://www.financialresearch.gov/money-market-funds/) | 免费 OFR API key (env `OFR_API_KEY`) — 注册即得 | `data/fetch_ofr_data.py` → `data/raw/ofr/{mmf_monitor,short_term_funding}.json` | R002 / R006 |
| **BIS** (Bank for International Settlements) | ✅ IN (partial) | `eurodollar` 部分（LBS quarterly）· `fx_swaps` USD basis (BIS Quarterly Review tables) · 跨境美元存量 | Public CSV / SDMX (https://stats.bis.org/) | 免费、无需 key | `data/fetch_bis_data.py` → `data/raw/bis/{lbs_usd,usd_basis}.json` | R002 / R005 (LBS lag ≥1 quarter) / R006 |
| **SIFMA** (Securities Industry and Financial Markets Association) | ✅ IN | `dealers` 资产负债表上下文（US Treasury holdings statistics, dealer positions） | Public Excel / CSV (https://www.sifma.org/resources/research/) | 免费、无需 key | `data/fetch_sifma_data.py` → `data/raw/sifma/dealer_positions.json` | R006 |
| **ICI** (Investment Company Institute) | ✅ IN | `retail_investors` (weekly MMF assets) · `offshore_mmf` (snapshot) · `gov_mmf` / `prime_mmf` 备选 | Public weekly CSV (https://www.ici.org/research/stats) | 免费、无需 key | `data/fetch_ici_data.py` → `data/raw/ici/{mmf_weekly,offshore_snapshot}.json` | R006 |
| **DTCC** (Depository Trust & Clearing Corporation) | ⏸ DEFER | 与 OFR cleared repo 数据高度重叠；OFR 已是这些指标的 data steward | FICC GCF Repo Index (public) | 免费 | (defer to S2.4 only if OFR data proves stale) | R006 |
| **SEC** (Securities and Exchange Commission) | ⏸ DEFER | N-MFP (MMF holdings detail) 与 13F 信息粒度过细；当前 v2 节点不需要 holding-level breakdown | Public EDGAR | 免费 | (defer — re-evaluate if P3 surfaces a need) | — |
| **IMF** (International Monetary Fund) | ⏸ DEFER | COFER (FX reserves composition) / CPIS (cross-border holdings)；当前 v2 没有专门的 FX 储备节点 | Public CSV / JSON | 免费 | (defer — out of current node coverage) | — |
| **FHLB Office of Finance** (proposed addition) | ✅ IN (spec 外加项) | `fhlb` (monthly debt issuance / advances outstanding) | Public CSV / PDF (https://www.fhlb-of.com/) | 免费、无需 key | `data/fetch_fhlb_data.py` → `data/raw/fhlb/of_monthly.json` | R002 / R006 |
| **FHFA** (Federal Housing Finance Agency, proposed addition) | ✅ IN (spec 外加项) | `gse` (monthly Fannie / Freddie holdings + advances) | Public XLSX / CSV | 免费、无需 key | `data/fetch_fhfa_data.py` → `data/raw/fhfa/gse_holdings.json` | R002 / R006 |
| **CFTC** (Commodity Futures Trading Commission, proposed addition) | ✅ IN (spec 外加项) | `hedge_funds` (TFF Treasury net short — leveraged-fund cash-futures basis trade gauge) | Public CSV (https://www.cftc.gov/MarketReports/CommitmentsofTraders/) | 免费、无需 key | `data/fetch_cftc_data.py` → `data/raw/cftc/tff_treasury.json` | R006 |

> **Sources added beyond the original spec whitelist** (FHLB-OF / FHFA / CFTC) are recorded in `decisions.md` D-001 with rationale (gap is real, source is free, source is canonical for that gap). Per `spec.md` §Constraints "扩展来源（OFR/BIS/SIFMA/DTCC/ICI/SEC/IMF/其它）须在 decisions.md 记录入选理由".

### §Appendix.3 — Credentialing strategy

- **Free / unauthenticated**: BIS, SIFMA, ICI, FHLB-OF, FHFA, CFTC. Direct `requests.get`. No env var.
- **Free with registration key**: OFR. Env var `OFR_API_KEY` in `.env`. Add to `.env.example` during S2.4. Fail-soft if key missing (skip fetch + log warning, do not crash build).
- **Paid / forbidden** (per spec Q9): Bloomberg (e.g., for `eur_usd_3m_basis`). Replaced by BIS USD basis CSV in `fx_swaps` edge.
- **Restricted** (e.g., SEC Form PF for hedge funds): not used. CFTC TFF is the public substitute.

### §Appendix.4 — Concepts with no plausible whitelist proxy (still `not_found` after S1.4)

| Node ID | Why no whitelist source helps | Mitigation strategy for P2 |
|---|---|---|
| `foreign_insurers` | NAIC statutory filings are quarterly, US-domiciled only, do not capture offshore dollar-asset-allocation behavior of EU/JP/UK insurers — which is the conceptual driver of this node. No public time series exists. | S2.3 will set `primary: null` + `reason` per spec §Acceptance #3. **No new risk** — already covered by R002. |
| `corporates_offshore` | Offshore corporate USD cash management is a private contractual practice. No regulator collects the time series. | Same — `primary: null` + `reason` in S2.3. Already covered by R002. |

### §Appendix.5 — Smoke verification (run on this Step)

| Item | Result |
|---|---|
| Date | 2026-04-26 |
| Gap enumeration source | `js/v2/proxy_registry.js` (read-only) |
| Gap nodes (external / partial / not_found) | 12 nodes (see §Appendix.1) |
| Gap edges (External / not_found) | 5 edges (triparty_repo / bilateral_repo / sponsored_repo / fx_swaps / eurodollar) |
| Whitelist sources IN scope | 7 (OFR · BIS · SIFMA · ICI · FHLB-OF · FHFA · CFTC) |
| Whitelist sources DEFERRED | 3 (DTCC · SEC · IMF — rationale in D-001) |
| Concepts permanently `not_found` | 2 (`foreign_insurers` · `corporates_offshore` — already in R002) |

---

## §Final consolidated table

> Single uniform table covering every series/endpoint inventoried under §FRED / §NYFed / §Treasury, plus placeholder rows for each IN-scope whitelist source from `decisions.md` D-001. Sort: FRED → NY Fed → Treasury → Whitelist (alphabetical). Per-source detail (units, transaction_type, v2 node IDs, smoke results) lives in the upstream sections.
>
> Status legend: `live` = fetcher implemented and verified this Phase · `pending-S2.4` = whitelist placeholder, fetcher to be authored in Phase 2 Step 2.4 per D-001.

| 来源 | 名称 / 标识 | 频率 | 获取方式 | 脚本路径 | 状态 |
|---|---|---|---|---|---|
| FRED | Commercial Paper Outstanding (Total) — `COMPOUT` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Financial Commercial Paper Outstanding — `FINCP` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Nonfinancial Commercial Paper Outstanding — `COMPAPER` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | MMF Time/Savings Deposits — `BOGZ1FL633030000Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Overnight Bank Funding Volume — `OBFRVOL` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | 3-Month Eurodollar Deposit Rate — `IR3TED01USM156N` | M | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | FHLB Advances Outstanding — `BOGZ1FL403069330Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Effective Federal Funds Rate — `EFFR` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Federal Funds Effective Rate — `DFF` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Federal Funds Volume — `EFFRVOL` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Reserve Balances — `WRESBAL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Interest on Reserve Balances Rate — `IORB` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Treasury General Account — `WDTGAL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Foreign Official Deposits at Fed — `WDFOA` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Primary Credit Loans — `WLCFLPCL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Central Bank Liquidity Swaps (Wed) — `SWPT` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Central Bank Liquidity Swaps (Wk Avg) — `WCBLSA` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fed Custody Holdings (Foreign Accts) — `WSEFINTL1` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fed Custody Marketable Treasuries — `WMTSECL1` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Federal Debt Held by Foreign — `FDHBFIN` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | ON RRP (Total) — `RRPONTTLD` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fed Reverse Repos (Wed) — `WLRRAL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | MMF Repos with Fed — `BOGZ1FL632051103Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fed Holdings: Treasuries — `TREAST` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | MMF Treasury Bills — `BOGZ1FL633061110Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | MMF Treasury Securities — `BOGZ1FL633061105Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Federal Debt: Total Public Debt — `GFDEBTN` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fannie Mae Mortgages Held — `BOGZ1FL403065015Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Freddie Mac Mortgages Held — `BOGZ1FL403065025Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Freddie Mac Total Assets — `BOGZ1FL404090423Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Deposits at Foreign-Related Insts — `DPSFRIM027SBOG` | M | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | FBO Deposits at Foreign Banks — `FBOUSIBFDFBA` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | SOFR — `SOFR` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | SOFR Volume — `SOFRVOL` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Fed Repo Operations: Treasuries — `RPONTSYD` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | MMF Total Repo Assets — `BOGZ1FL632051000Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Broker-Dealer Repo Liabilities — `BOGZ1FL662151003Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Hedge Fund Repo Assets — `BOGZ1FL622051003Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Broker-Dealer Total Assets — `BOGZ1FL664090663Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Discount Window Primary Credit Rate — `DPCREDIT` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Federal Reserve Total Assets — `WALCL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Total Money Market Fund Assets — `MMMFFAQ027S` | M | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Government MMF Total Assets — `BOGZ1FL634090033Q` | Q | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | TGA (Weekly H.4.1) — `WTREGEN` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | BTFP Outstanding — `WLCFOCEL` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | CB Liquidity Swaps (H.4.1 Wed) — `H41RESPPALDKNWW` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Overnight Bank Funding Rate — `OBFR` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | 1-Mo Financial CP Rate — `DCPF1M` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | 1-Mo Nonfinancial CP Rate — `DCPN30` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | Bank Credit (H.8) — `TOTBKCR` | W | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | 4-Wk T-Bill Rate — `DTB4WK` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| FRED | 3-Mo T-Bill Rate — `DTB3` | D | `fredapi.Fred.get_series` | `data/fetch_fred_data.py` | live |
| NY Fed | Secured Overnight Financing Rate — `sofr` | D | `requests.get /rates/secured/sofr/search.json` | `data/fetch_nyfed_data.py` | live |
| NY Fed | Effective Federal Funds Rate — `effr` | D | `requests.get /rates/unsecured/effr/search.json` | `data/fetch_nyfed_data.py` | live |
| NY Fed | ON RRP Operations — `rrp_ops` | D | `requests.get /rp/reverserepo/propositions/search.json` | `data/fetch_nyfed_data.py` | live |
| NY Fed | Standing Repo Facility Operations — `srf_ops` | D | `requests.get /rp/repo/all/results/last/500.json` | `data/fetch_nyfed_data.py` | live |
| NY Fed | SOMA Holdings Summary — `soma_summary` | W | `requests.get /soma/summary.json` | `data/fetch_nyfed_data.py` | live |
| Treasury | TGA Daily Operating Cash Balance — `tga_daily` | D | paginated `requests.get /v1/accounting/dts/operating_cash_balance` | `data/fetch_treasury_data.py` | live |
| Treasury | Treasury Auctions — `auctions` | irregular | paginated `requests.get /v1/accounting/od/auctions_query` | `data/fetch_treasury_data.py` | live |
| Whitelist · BIS | LBS USD cross-border + USD basis tables | Q (LBS), W (basis) | public CSV / SDMX (https://stats.bis.org/) | `data/fetch_bis_data.py` (proposed) | pending-S2.4 |
| Whitelist · CFTC | TFF Treasury net short (leveraged funds) | W | public CSV (cftc.gov/MarketReports/CommitmentsofTraders) | `data/fetch_cftc_data.py` (proposed) | pending-S2.4 |
| Whitelist · FHFA | GSE monthly holdings (Fannie / Freddie) | M | public XLSX / CSV | `data/fetch_fhfa_data.py` (proposed) | pending-S2.4 |
| Whitelist · FHLB-OF | FHLB monthly debt issuance / advances | M | public CSV / PDF (fhlb-of.com) | `data/fetch_fhlb_data.py` (proposed) | pending-S2.4 |
| Whitelist · ICI | MMF weekly assets + offshore snapshots | W | public CSV (ici.org/research/stats) | `data/fetch_ici_data.py` (proposed) | pending-S2.4 |
| Whitelist · OFR | MMF Monitor + Short-Term Funding Monitor (triparty / bilateral / sponsored repo) | M (MMF), W (STF) | public REST + CSV; env `OFR_API_KEY` | `data/fetch_ofr_data.py` (proposed) | pending-S2.4 |
| Whitelist · SIFMA | Dealer positions / UST holdings statistics | M | public Excel / CSV (sifma.org/resources/research) | `data/fetch_sifma_data.py` (proposed) | pending-S2.4 |

**Row count**: 52 FRED + 5 NY Fed + 2 Treasury + 7 whitelist placeholders = **66 rows**.

---

## §P1 Wrap-up

### Counts
- FRED live: 52 series (43 v1 + 9 v2)
- NY Fed live: 5 endpoints (`sofr` · `effr` · `rrp_ops` · `srf_ops` · `soma_summary`)
- Treasury live: 2 endpoints (`tga_daily` · `auctions`)
- Whitelist pending-S2.4: 7 sources (BIS · CFTC · FHFA · FHLB-OF · ICI · OFR · SIFMA)
- Whitelist deferred (D-001): 3 sources (DTCC · SEC · IMF)
- Permanent `not_found` nodes (D-001): 2 (`foreign_insurers` · `corporates_offshore`)

### Phase 1 exit-criteria coverage (against spec §Acceptance #1)

| Sub-criterion | Status | Evidence |
|---|---|---|
| 覆盖 FRED / Treasury / NY Fed 三来源全部入选序列 | ✅ | §FRED / §NYFed / §Treasury sections + §Final 59-row authoritative-source block |
| 列含：来源 · 名称/标识 · 频率 · 获取方式 · 脚本路径 | ✅ | §Final consolidated table column set matches verbatim (plus `状态` for forward-completeness) |
| 扩展来源（白名单）入选项作为附录列出 | ✅ | §Appendix (5 sub-tables) + 7 placeholder rows in §Final |
| 每个序列有可复现的 fetch 命令 | ✅ | smoke commands embedded per §FRED / §NYFed / §Treasury; all three smokes captured today's mtime / status 200 |
| Inventory 已落库 | ✅ | `data/series_inventory.md` committed |

### Open risks at P1 exit (all `open`, none escalated)
- R001 (cross-source overlap口径) — progressed: 5 FRED↔NYFed + 2 FRED↔Treasury overlaps explicit in inventory; reconciliation logic deferred to S2.5.
- R002 (no-proxy concepts) — mitigated by D-001 (12/12 gap nodes have a candidate source or are explicitly permanent not_found).
- R003 (geometry / viewBox regression) — untouched in P1; first surfaces in P3.1.
- R004 (stale window thresholds) — untouched in P1; planned for P2 / P3.3.
- R005 (short-history series — SRF) — observed: `srf_ops.json` is 78 KB (sparse); partial-window fallback in S2.2 required.
- R006 (external source CI fragility) — mitigation written in D-001 §Appendix.3 (free-only + fail-soft on missing OFR key).
- R007 (color clash) — untouched in P1; first surfaces in P3.3.

### Decisions log at P1 exit
- D-001 (whitelist IN/deferred set + credentialing strategy) — `decisions.md`.

### Pointer
- See [`.ief/decisions.md`](../.ief/decisions.md) D-001 for the binding whitelist scope used by `pending-S2.4` rows above.
