/**
 * v2/proxy_registry.js — central mapping from node / edge identifiers to
 * data series proxies that quantify their balance / flow.
 *
 * Each record:
 *   primary:      { source, series, freq, unit?, metric?, note? }   main proxy
 *   secondary?:   alternate proxy when primary is missing or low freq
 *   rationale:    1–2 line theoretical / empirical justification
 *   proxy_status: "ok" (default) | "partial" | "external" | "not_found"
 *
 * Sources:
 *   FRED      — data/json/time_series.json (loaded by v1 DataLoader)
 *   Derived   — data/json/pressure_indicators.json (Module A output)
 *   NYFed     — data/json/nyfed_operations.json
 *   Treasury  — data/json/treasury_flows.json
 *   FedBS     — data/json/fed_balance_sheet.json
 *   OFR / External — out-of-band datasets (manual download / scrape)
 *
 * Node IDs match v1's `js/constants.js` NODES array exactly. Edge keys
 * are `transaction_type` strings used by Module E when populating EDGES.
 */

// ──────────────────────────────────────────────────────────────────────
// Node proxies
// ──────────────────────────────────────────────────────────────────────
export const NODE_PROXIES = {
  // ── Fed balance-sheet liabilities & assets ────────────────────────
  bs_reserve_balances: {
    primary:   { source: "FRED",  series: "WRESBAL", freq: "W", unit: "Mil. USD" },
    secondary: { source: "FRED",  series: "WALCL",   freq: "W" },
    rationale: "Reserve balances are Fed's net injection into the banking system; ΔWRESBAL vs SOFR-IORB ρ≈-0.4 in QT regimes.",
  },
  bs_tga: {
    primary:   { source: "Treasury", series: "tga_balance_usd_m", freq: "D" },
    secondary: { source: "FRED",     series: "WTREGEN",           freq: "W" },
    rationale: "TGA build = drain from private sector; ΔTGA vs ΔWRESBAL ρ≈-0.7~-0.9 in steady-state.",
  },
  bs_rrp: {
    primary:   { source: "FRED",  series: "RPONTSYD", freq: "D" },
    secondary: { source: "NYFed", series: "rrp_ops",  freq: "D" },
    rationale: "ON RRP balance + participating counterparties; the latter leads usage by 1–2 months.",
  },
  bs_rrp_omo: {
    primary:   { source: "FRED",  series: "RPONTSYD", freq: "D" },
    rationale: "Open-market ON RRP take-up — proxied by the headline RPONTSYD (which excludes foreign repo pool).",
  },
  bs_foreign_repo: {
    primary:   { source: "FRED",  series: "WLRRAL", freq: "W" },
    rationale: "Foreign repo pool sits inside total reverse repo liability (WLRRAL); offshore USD reservoir for FCBs.",
  },
  bs_primary_credit: {
    primary:   { source: "FRED",  series: "WLCFLPCL", freq: "W" },
    rationale: "Discount Window primary credit; stigma-suppressed → any non-zero is a stress signal.",
  },
  bs_cb_swaps: {
    primary:   { source: "FRED",  series: "H41RESPPALDKNWW", freq: "W" },
    rationale: "Central-bank USD liquidity swaps; spikes in 2020-03 and 2023-03 are textbook offshore stress markers.",
  },
  bs_treasuries: {
    primary:   { source: "FRED",  series: "TREAST", freq: "W" },
    rationale: "Fed UST holdings — direct gauge of QE/QT pace.",
  },
  bs_other_liab: {
    proxy_status: "partial",
    rationale: "H.4.1 'other liabilities' is a residual; no clean single proxy.",
  },
  bs_fed_notes: {
    primary:   { source: "FRED", series: "CURRCIR", freq: "W" },
    rationale: "Currency in circulation — slow-moving structural liability.",
  },
  bs_agency_mbs:       { primary: { source: "FRED", series: "MBST", freq: "W" }, rationale: "Fed's agency MBS holdings; QT runoff cap drives the slope." },
  bs_foreign_reserves: { proxy_status: "partial", rationale: "Foreign currency holdings on H.4.1; small and mostly stable." },
  bs_others_assets:    { proxy_status: "partial", rationale: "Residual asset bucket; no clean proxy." },

  // ── Banks & dealers (right-panel hexagons) ────────────────────────
  us_banks: {
    primary:   { source: "FRED", series: "TOTBKCR", freq: "W" },
    rationale: "H.8 total bank credit reflects asset-side scale; deposit outflows raise wholesale-funding dependence.",
  },
  us_fbo: {
    primary:   { source: "FRED", series: "H8B1058NCBCMG", freq: "W" },
    rationale: "Foreign banking offices in the U.S. — no retail deposits, rely on FX swaps + IORB arbitrage; marginal RRP players.",
  },
  dealers: {
    primary:   { source: "External", series: "primary_dealer_stats", note: "NY Fed weekly Primary Dealer Statistics CSV (manual download)" },
    rationale: "Dealer net UST coupon position is the most direct proxy for SLR balance-sheet capacity.",
    proxy_status: "partial",
  },

  // ── Onshore investors ─────────────────────────────────────────────
  retail_investors:    { proxy_status: "partial", rationale: "ICI weekly money funds + Fed Z.1 are the closest public proxies." },
  gov_mmf: {
    primary:   { source: "External", series: "ofr_mmf_govt_aum", freq: "M", note: "OFR MMF Monitor monthly download" },
    secondary: { source: "FRED",     series: "MMMFFAQ027S",      freq: "Q" },
    rationale: "Govt MMF AUM ρ>0.85 with ON RRP balance (2021–2023).",
    proxy_status: "partial",
  },
  prime_mmf: {
    primary:   { source: "External", series: "ofr_mmf_prime_aum", freq: "M" },
    rationale: "Prime MMF is the dominant CP / Eurodollar buyer.",
    proxy_status: "partial",
  },
  securities_lenders: {
    primary:   { source: "NYFed", series: "soma_summary", metric: "seclending", freq: "D" },
    rationale: "SOMA securities lending volume reflects cash-vs-collateral imbalance.",
    proxy_status: "partial",
  },
  corporates_onshore: {
    primary:   { source: "FRED", series: "COMPAPER", freq: "W" },
    rationale: "Non-financial CP outstanding; net issuance vs DCPN30-OIS inverts during stress.",
  },
  fcb_swf_supra_onshore: {
    primary:   { source: "FRED", series: "WLRRAL", freq: "W", note: "Foreign repo pool inside total reverse repo" },
    rationale: "Foreign central banks place USD via NY Fed reverse repo — offshore USD reservoir.",
  },
  hedge_funds: {
    primary:   { source: "External", series: "ofr_cleared_repo_sponsored", freq: "W" },
    secondary: { source: "External", series: "cftc_tff_treasury_net_short", freq: "W" },
    rationale: "Post-2021 cash-futures basis trade made HFs the marginal UST buyer; sponsored cleared repo proxies leverage.",
    proxy_status: "partial",
  },

  // ── Government entities ───────────────────────────────────────────
  fhlb: {
    primary:   { source: "External", series: "fhlb_of_monthly", note: "FHLB Office of Finance monthly report" },
    rationale: "FHLB short-term debt issuance is the largest single source in unsecured money markets; 2019-09 reserve drawdown triggered the repo spike.",
    proxy_status: "external",
  },
  gse: {
    primary:   { source: "External", series: "fhfa_gse_holdings", note: "FHFA monthly report" },
    rationale: "GSEs are non-IORB-eligible discount sellers in fed funds — the key driver of the EFFR-IORB spread.",
    proxy_status: "external",
  },
  us_treasury: {
    primary:   { source: "Treasury", series: "tga_balance_usd_m",   freq: "D" },
    secondary: { source: "Treasury", series: "auctions_btc_by_term", freq: "irregular" },
    rationale: "TGA + auction stop-out yields + bid-to-cover jointly characterize issuance cadence.",
  },

  // ── Offshore entities ─────────────────────────────────────────────
  fcb_swf_supra_offshore: {
    primary:   { source: "FRED", series: "WLRRAL", freq: "W" },
    rationale: "Same foreign repo pool as the onshore-mirror node; presented offshore for flow visualization.",
  },
  foreign_insurers: {
    proxy_status: "not_found",
    rationale: "No public daily/weekly time series; NAIC quarterly statutory filings are the closest indirect proxy.",
  },
  foreign_banks: {
    primary:   { source: "FRED", series: "H8B1058NCBCMG", freq: "W" },
    rationale: "U.S. branches of foreign banks proxy the foreign-bank USD liability footprint.",
  },
  corporates_offshore: {
    proxy_status: "not_found",
    rationale: "Offshore-USD corporate cash management is not publicly disclosed.",
  },
  offshore_mmf: {
    proxy_status: "partial",
    rationale: "ICI offshore money fund snapshots exist but are not daily/weekly time series.",
  },
};

// ──────────────────────────────────────────────────────────────────────
// Edge proxies (keyed by transaction_type — populated by Module E)
// ──────────────────────────────────────────────────────────────────────
export const EDGE_PROXIES = {
  fed_funds: {
    volume_proxy: { source: "NYFed",  series: "effr",                  metric: "volume" },
    price_proxy:  { source: "Derived", series: "effr_iorb_spread_bps" },
    rationale: "EFFR daily volume is small ($70-120B); the spread is the real signal — < -10bp suggests GSE pressure.",
  },
  triparty_repo: {
    volume_proxy: { source: "External", series: "ofr_triparty_volume" },
    price_proxy:  { source: "Derived",  series: "tgcr_iorb_spread_bps" },
    rationale: "$4-5T daily; persistent TGCR > IORB indicates strong reserve demand from banks.",
    proxy_status: "partial",
  },
  bilateral_repo: {
    volume_proxy: { source: "External", series: "ofr_cleared_bilateral_repo" },
    price_proxy:  { source: "Derived",  series: "bgcr_tgcr_spread_bps" },
    rationale: "Bilateral spread widening → dealer balance-sheet tightness.",
    proxy_status: "partial",
  },
  sponsored_repo: {
    volume_proxy: { source: "External", series: "ofr_cleared_repo_sponsored" },
    price_proxy:  { source: "Derived",  series: "sofr_p99_median_gap_bps" },
    rationale: "Sponsored cleared volume proxies HF leverage; 99th-percentile jumps foreshadow tail stress.",
    proxy_status: "partial",
  },
  on_rrp: {
    volume_proxy:        { source: "FRED",    series: "RPONTSYD" },
    price_proxy:         { source: "Derived", series: "rrp_tbill4w_spread_bps" },
    counterparties_proxy:{ source: "NYFed",   series: "rrp_ops", metric: "acceptedCounterparties" },
    rationale: "Positive spread → MMF parks at RRP; negative → drains to bills. Counterparty count leads usage by 1-2 months.",
  },
  srf: {
    volume_proxy: { source: "NYFed",  series: "srf_ops",            metric: "totalAmtAccepted" },
    price_proxy:  { source: "Derived", series: "srf_sofr_p99_gap_bps" },
    rationale: "Normally zero; any non-zero use is a danger signal (2024-09-30, 2024-12-31 already triggered).",
  },
  discount_window: {
    volume_proxy: { source: "FRED",    series: "WLCFLPCL" },
    price_proxy:  { source: "Derived", series: "pcr_iorb_spread_bps" },
    rationale: "Stigma-suppressed; spiked to $150B+ during the 2023-03 SVB week.",
  },
  commercial_paper: {
    volume_proxy: { source: "FRED", series: "COMPAPER" },
    price_proxy:  { source: "FRED", series: "DCPF1M" },
    rationale: "DCPF1M-OIS > 50bp marks corporate short-funding stress.",
  },
  fx_swaps: {
    volume_proxy: { source: "FRED",     series: "H41RESPPALDKNWW" },
    price_proxy:  { source: "External", series: "eur_usd_3m_basis", note: "Bloomberg / FRBNY G.5" },
    rationale: "FX basis < -50bp = offshore stress; led SOFR in 2020-03, 2022-09 and 2023-03.",
    proxy_status: "partial",
  },
  treasury_issuance: {
    volume_proxy: { source: "Treasury", series: "auctions_btc_by_term", metric: "total_accepted" },
    price_proxy:  { source: "Treasury", series: "auctions_btc_by_term", metric: "high_yield" },
    rationale: "T-bill stop-out minus ON RRP rate is the fundamental driver of RRP balance direction.",
  },
  iorb_corridor: {
    volume_proxy: { source: "FRED", series: "WRESBAL" },
    price_proxy:  { source: "FRED", series: "IORB" },
    rationale: "IORB and ON RRP rate form the corridor; floor = excess liquidity, cap = tight liquidity.",
  },

  // Edges where no clean public proxy exists
  eurodollar: {
    proxy_status: "not_found",
    rationale: "Post-LIBOR (2023-06) there is no daily offshore-USD volume; BIS LBS is quarterly and lagged.",
    fallback:  "Use EUR-USD FX basis as stress proxy (already covered on the fx_swaps edge).",
  },
};

/** Convenience: return the proxy record for a node id, or null. */
export function getNodeProxy(nodeId) {
  return NODE_PROXIES[nodeId] ?? null;
}

/** Convenience: return the proxy record for an edge transaction_type, or null. */
export function getEdgeProxy(transactionType) {
  if (!transactionType) return null;
  return EDGE_PROXIES[transactionType] ?? null;
}
