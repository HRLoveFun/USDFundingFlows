/**
 * constants.js — Core configuration for the U.S. Dollar Funding Flows diagram.
 * Left-right layout: Federal Reserve (left) || U.S. Dollar Funding Market (right).
 * 28 entity nodes, ~65 edges, 8 arrow color types.
 */

// ── Viewbox dimensions ──────────────────────────────────────────────────
export const WIDTH = 2800;
export const HEIGHT = 1700;

// ── Shape types ─────────────────────────────────────────────────────────
export const SHAPE = {
  HEXAGON:   "hexagon",    // Banks
  PENTAGON:  "pentagon",   // Dealers
  CIRCLE:    "circle",     // Investors, funds, corporates, insurers
  RECTANGLE: "rectangle",  // U.S. Treasury
  BS_ITEM:   "bs_item",    // Balance sheet line items
};

// ── Shape fill colors ───────────────────────────────────────────────────
export const SHAPE_COLORS = {
  hexagon:   "#5C6BC0",  // indigo
  pentagon:  "#7E57C2",  // deep purple
  circle:    "#26A69A",  // teal
  rectangle: "#607D8B",  // blue-gray
  bs_item:   "#E8EAF6",  // very light indigo
};

// ── Shape sizing ────────────────────────────────────────────────────────
export const SHAPE_SIZES = {
  hexagon:   { radius: 50 },
  pentagon:  { radius: 46 },
  circle:    { radius: 44 },
  rectangle: { width: 155, height: 58 },
  bs_item:   { width: 275, height: 30 },
};

// ── Node category colors (for sidebar legend) ───────────────────────────
export const CATEGORY_COLORS = {
  hexagon:   "#5C6BC0",
  pentagon:  "#7E57C2",
  circle:    "#26A69A",
  rectangle: "#607D8B",
  bs_item:   "#E8EAF6",
};

// ── Arrow / edge color definitions ──────────────────────────────────────
export const EDGE_COLORS = {
  red:    { color: "#E53935", name: "Fed Core Liquidity" },
  brown:  { color: "#795548", name: "FHLB / Offshore MMF" },
  cyan:   { color: "#00BCD4", name: "RRP / FHLB Flows" },
  green:  { color: "#4CAF50", name: "Regular Market Flows" },
  black:  { color: "#424242", name: "Interbank / Cross-border" },
  purple: { color: "#9C27B0", name: "Cross-border / Government" },
  orange: { color: "#FF9800", name: "Dealer / Offshore Flows" },
  pink:   { color: "#E91E63", name: "Offshore → Onshore MMF" },
};

// ── Transaction Types (mapped from EDGE_COLORS for sidebar/tooltip compat) ─
export const TRANSACTION_TYPES = Object.entries(EDGE_COLORS).map(([id, cfg]) => ({
  id,
  name: cfg.name,
  color: cfg.color,
  dash: "",
}));

// ── Section / group definitions (rendered as background rectangles) ─────
// Left-right layout: Federal Reserve (left) || U.S. Dollar Funding Market (right)
export const SECTIONS = [
  // ── LEFT PANEL: FEDERAL RESERVE ──────────────────────────────────────
  { id: "fed",         label: "FEDERAL RESERVE",             x: 20,   y: 10,   w: 1170, h: 440, style: "header" },
  { id: "bs",          label: "BALANCE SHEET",               x: 45,   y: 55,   w: 1120, h: 385, style: "subheader" },

  // ── RIGHT PANEL: U.S. DOLLAR FUNDING MARKET ──────────────────────────
  { id: "market",      label: "U.S. DOLLAR FUNDING MARKET",  x: 1210, y: 10,   w: 1580, h: 1680, style: "header" },
  { id: "onshore",     label: "ONSHORE ENTITIES",            x: 1230, y: 55,   w: 920,  h: 1620, style: "subheader" },
  { id: "offshore",    label: "OFFSHORE ENTITIES",           x: 2180, y: 55,   w: 590,  h: 1620, style: "subheader" },
  // Onshore sub-groups
  { id: "banks_dealers",    label: "Banks and Dealers",           x: 1245, y: 95,   w: 890,  h: 290,  style: "group" },
  { id: "onshore_inv",      label: "Onshore Investors",           x: 1245, y: 415,  w: 890,  h: 520,  style: "group" },
  { id: "institutional_inv", label: "",                            x: 1380, y: 450,  w: 735,  h: 465,  style: "dashed" },
  { id: "gov_entities",     label: "U.S. Government Entities",    x: 1245, y: 965,  w: 890,  h: 230,  style: "group" },
];

// ── Text annotations (column headers, hierarchy labels) ─────────────────
export const ANNOTATIONS = [
  { text: "Assets",            x: 280, y: 95,   fontSize: 15, fontWeight: 700, fill: "#555" },
  { text: "Liabilities",       x: 820, y: 95,   fontSize: 15, fontWeight: 700, fill: "#555" },
  { text: "Other Liabilities", x: 720, y: 310,  fontSize: 11, fontWeight: 600, fill: "#666" },
  { text: "Deposits",          x: 750, y: 330,  fontSize: 10, fontWeight: 400, fill: "#888", fontStyle: "italic" },
];

// ── 28 Entity Nodes ─────────────────────────────────────────────────────
// Layout: LEFT = Federal Reserve | RIGHT = U.S. Dollar Funding Market

export const NODES = [
  // ════════════════════════════════════════════════════════════════════
  // LEFT PANEL — FEDERAL RESERVE / BALANCE SHEET
  // ════════════════════════════════════════════════════════════════════

  // ── Balance Sheet — Assets (left column) ────────────────────────────
  { id: "bs_treasuries",      label: "U.S. Treasury Securities,\nAgency Debt and MBS",     x: 270,  y: 145,  shape: "bs_item", group: "bs_assets" },
  { id: "bs_primary_credit",  label: "Primary Credit Facility",                             x: 270,  y: 195,  shape: "bs_item", group: "bs_assets" },
  { id: "bs_cb_swaps",        label: "Central Bank USD\nLiquidity Swaps",                   x: 270,  y: 245,  shape: "bs_item", group: "bs_assets" },
  { id: "bs_foreign_reserves",label: "Foreign Reserves,\nand Others",                       x: 270,  y: 295,  shape: "bs_item", group: "bs_assets" },

  // ── Balance Sheet — Liabilities (right column) ──────────────────────
  { id: "bs_reserve_balances", label: "Reserve Balances",                                   x: 830,  y: 135,  shape: "bs_item", group: "bs_liabilities" },
  { id: "bs_fed_notes",        label: "Federal Reserve Notes",                              x: 830,  y: 180,  shape: "bs_item", group: "bs_liabilities" },
  { id: "bs_rrp",              label: "Reverse Repurchase\nAgreements",                     x: 830,  y: 230,  shape: "bs_item", group: "bs_liabilities" },
  { id: "bs_foreign_repo",     label: "Foreign repo pool",                                  x: 830,  y: 275,  shape: "bs_item", group: "bs_liabilities" },
  { id: "bs_tga",              label: "U.S. Treasury\nGeneral Account",                     x: 910,  y: 365,  shape: "bs_item", group: "bs_liabilities" },
  { id: "bs_fhlb_deposits",    label: "FHLB, DFMU, and\nother deposits",                   x: 910,  y: 405,  shape: "bs_item", group: "bs_liabilities" },

  // ════════════════════════════════════════════════════════════════════
  // RIGHT PANEL — U.S. DOLLAR FUNDING MARKET
  // ════════════════════════════════════════════════════════════════════

  // ── Banks and Dealers (onshore, upper area) ─────────────────────────
  { id: "us_banks",    label: "U.S. Banks",                              x: 1400, y: 200,  shape: "hexagon",  group: "banks_dealers" },
  { id: "us_fbo",      label: "U.S. Branches of\nForeign Banks",         x: 1760, y: 200,  shape: "hexagon",  group: "banks_dealers" },
  { id: "dealers",     label: "Dealers",                                  x: 1580, y: 320,  shape: "pentagon", group: "banks_dealers" },

  // ── Onshore Investors (middle area) ─────────────────────────────────
  { id: "retail_investors",      label: "Retail\nInvestors",             x: 1320, y: 510,  shape: "circle",   group: "onshore_inv" },
  // Inside dashed institutional investor box
  { id: "gov_mmf",               label: "Government\nMoney Market Funds", x: 1480, y: 490,  shape: "circle",   group: "institutional_inv" },
  { id: "prime_mmf",             label: "Prime Money\nMarket Funds",     x: 1680, y: 490,  shape: "circle",   group: "institutional_inv" },
  { id: "securities_lenders",    label: "Securities\nLenders",          x: 1910, y: 490,  shape: "circle",   group: "institutional_inv" },
  { id: "corporates_onshore",    label: "Corporates",                    x: 1520, y: 690,  shape: "circle",   group: "institutional_inv" },
  { id: "fcb_swf_supra_onshore", label: "FCBs, SWFs,\nSupras",         x: 1750, y: 690,  shape: "circle",   group: "institutional_inv" },
  { id: "hedge_funds",           label: "Hedge Funds &\nOther Managers", x: 1990, y: 690,  shape: "circle",   group: "institutional_inv" },

  // ── U.S. Government Entities (lower onshore area) ───────────────────
  { id: "fhlb",         label: "Federal Home\nLoan Banks",               x: 1420, y: 1090, shape: "hexagon",  group: "gov_entities" },
  { id: "gse",          label: "Fannie, Freddie,\nand other GSEs",      x: 1700, y: 1090, shape: "hexagon",  group: "gov_entities" },
  { id: "us_treasury",  label: "U.S. Treasury",                          x: 2020, y: 1090, shape: "rectangle", group: "gov_entities" },

  // ── Offshore Entities (far right column) ────────────────────────────
  { id: "fcb_swf_supra_offshore", label: "FCBs, SWFs,\nSupras",         x: 2475, y: 155,  shape: "circle",   group: "offshore" },
  { id: "foreign_insurers",       label: "Foreign Insurers &\nOther Managers", x: 2475, y: 345,  shape: "circle",   group: "offshore" },
  { id: "foreign_banks",          label: "Foreign Banks &\nForeign Branches\nof U.S. Banks", x: 2475, y: 550,  shape: "hexagon", group: "offshore" },
  { id: "corporates_offshore",    label: "Corporates",                    x: 2475, y: 785,  shape: "circle",   group: "offshore" },
  { id: "offshore_mmf",           label: "Offshore Money\nMarket Funds", x: 2475, y: 1025, shape: "circle",   group: "offshore" },
];

// ── ~49 Edge definitions (directed flows) ───────────────────────────────
// color: arrow color key from EDGE_COLORS
// seriesIds: FRED series to display on this edge
export const EDGES = [
  // ── Red: Fed Core Liquidity (bidirectional) ─────────────────────────
  { id: "red_resbal_usbanks",  source: "bs_reserve_balances", target: "us_banks",    color: "red", seriesIds: ["WRESBAL", "IORB"], label: "Reserve Balances" },
  { id: "red_usbanks_resbal",  source: "us_banks",    target: "bs_reserve_balances", color: "red", seriesIds: ["WRESBAL"],         label: "Reserve Balances" },
  { id: "red_tga_ustreas",     source: "bs_tga",      target: "us_treasury",         color: "red", seriesIds: [],                  label: "TGA" },
  { id: "red_ustreas_tga",     source: "us_treasury", target: "bs_tga",              color: "red", seriesIds: [],                  label: "TGA" },

  // ── Brown ───────────────────────────────────────────────────────────
  { id: "brown_usbanks_fhlb",   source: "us_banks",      target: "fhlb",          color: "brown", seriesIds: [],                  label: "" },
  { id: "brown_fbank_offmmf",   source: "foreign_banks",  target: "offshore_mmf",  color: "brown", seriesIds: [],                  label: "" },

  // ── Cyan ────────────────────────────────────────────────────────────
  { id: "cyan_rrp_govmmf",      source: "bs_rrp",         target: "gov_mmf",               color: "cyan", seriesIds: ["RRPONTTLD"], label: "ON RRP" },
  { id: "cyan_govmmf_rrp",      source: "gov_mmf",        target: "bs_rrp",                color: "cyan", seriesIds: ["RRPONTTLD"], label: "ON RRP" },
  { id: "cyan_frepo_fcboff",    source: "bs_foreign_repo", target: "fcb_swf_supra_offshore", color: "cyan", seriesIds: ["WDFOA"],    label: "Foreign Repo Pool" },
  { id: "cyan_fcboff_frepo",    source: "fcb_swf_supra_offshore", target: "bs_foreign_repo", color: "cyan", seriesIds: ["WDFOA"],    label: "Foreign Repo Pool" },
  { id: "cyan_fhlb_govmmf",     source: "fhlb",           target: "gov_mmf",               color: "cyan", seriesIds: ["EFFR"],      label: "" },
  { id: "cyan_fhlb_hedge",      source: "fhlb",           target: "hedge_funds",            color: "cyan", seriesIds: [],            label: "" },
  { id: "cyan_fcbon_hedge",     source: "fcb_swf_supra_onshore", target: "hedge_funds",     color: "cyan", seriesIds: [],            label: "" },

  // ── Green: Regular Market Flows ─────────────────────────────────────
  { id: "green_usbanks_usfbo",   source: "us_banks",     target: "us_fbo",                  color: "green", seriesIds: [],           label: "" },
  { id: "green_usfbo_usbanks",   source: "us_fbo",       target: "us_banks",                color: "green", seriesIds: [],           label: "" },
  { id: "green_dealers_usbanks", source: "dealers",       target: "us_banks",                color: "green", seriesIds: [],           label: "" },
  { id: "green_primemmf_corp",   source: "prime_mmf",     target: "corporates_onshore",      color: "green", seriesIds: ["COMPAPER"], label: "" },
  { id: "green_seclend_corp",    source: "securities_lenders", target: "corporates_onshore",  color: "green", seriesIds: [],           label: "" },
  { id: "green_fcbon_corp",      source: "fcb_swf_supra_onshore", target: "corporates_onshore", color: "green", seriesIds: [],        label: "" },
  { id: "green_corp_hedge",      source: "corporates_onshore", target: "hedge_funds",         color: "green", seriesIds: [],           label: "" },
  { id: "green_fcboff_finins",   source: "fcb_swf_supra_offshore", target: "foreign_insurers", color: "green", seriesIds: [],          label: "" },
  { id: "green_fcboff_fbank",    source: "fcb_swf_supra_offshore", target: "foreign_banks",    color: "green", seriesIds: [],          label: "" },
  { id: "green_finins_fbank",    source: "foreign_insurers", target: "foreign_banks",         color: "green", seriesIds: [],           label: "" },
  { id: "green_fbank_corpoff",   source: "foreign_banks",  target: "corporates_offshore",     color: "green", seriesIds: [],           label: "" },
  { id: "green_corpoff_fbank",   source: "corporates_offshore", target: "foreign_banks",      color: "green", seriesIds: [],           label: "" },
  { id: "green_offmmf_corpoff",  source: "offshore_mmf",   target: "corporates_offshore",     color: "green", seriesIds: [],           label: "" },

  // ── Black: Interbank / Cross-border ─────────────────────────────────
  { id: "black_usbanks_usfbo",   source: "us_banks",     target: "us_fbo",                  color: "black", seriesIds: [],           label: "" },
  { id: "black_usfbo_usbanks",   source: "us_fbo",       target: "us_banks",                color: "black", seriesIds: [],           label: "" },
  { id: "black_usbanks_dealers", source: "us_banks",      target: "dealers",                 color: "black", seriesIds: [],           label: "" },
  { id: "black_usfbo_dealers",   source: "us_fbo",        target: "dealers",                 color: "black", seriesIds: [],           label: "" },
  { id: "black_hedge_dealers",   source: "hedge_funds",    target: "dealers",                 color: "black", seriesIds: [],           label: "" },
  { id: "black_usfbo_fcboff",    source: "us_fbo",        target: "fcb_swf_supra_offshore",  color: "black", seriesIds: [],           label: "" },
  { id: "black_fcboff_usfbo",    source: "fcb_swf_supra_offshore", target: "us_fbo",         color: "black", seriesIds: [],           label: "" },
  { id: "black_usfbo_fbank",     source: "us_fbo",        target: "foreign_banks",           color: "black", seriesIds: [],           label: "" },
  { id: "black_fbank_usfbo",     source: "foreign_banks",  target: "us_fbo",                 color: "black", seriesIds: [],           label: "" },
  { id: "black_fbank_dealers",   source: "foreign_banks",  target: "dealers",                 color: "black", seriesIds: [],           label: "" },

  // ── Purple: Cross-border / Government ───────────────────────────────
  { id: "purple_usbanks_usfbo",  source: "us_banks",     target: "us_fbo",                  color: "purple", seriesIds: [],          label: "" },
  { id: "purple_usfbo_usbanks",  source: "us_fbo",       target: "us_banks",                color: "purple", seriesIds: [],          label: "" },
  { id: "purple_gse_ustreas",    source: "gse",          target: "us_treasury",              color: "purple", seriesIds: [],          label: "" },
  { id: "purple_fcboff_fcbon",   source: "fcb_swf_supra_offshore", target: "fcb_swf_supra_onshore", color: "purple", seriesIds: [],  label: "" },
  { id: "purple_hedge_fbank",    source: "hedge_funds",   target: "foreign_banks",            color: "purple", seriesIds: [],          label: "" },
  { id: "purple_fbank_hedge",    source: "foreign_banks",  target: "hedge_funds",             color: "purple", seriesIds: [],          label: "" },
  { id: "purple_ustreas_fcboff", source: "us_treasury",   target: "fcb_swf_supra_offshore",   color: "purple", seriesIds: [],          label: "" },
  { id: "purple_fcboff_corpoff", source: "fcb_swf_supra_offshore", target: "corporates_offshore", color: "purple", seriesIds: [],     label: "" },

  // ── Orange ──────────────────────────────────────────────────────────
  { id: "orange_dealers_usfbo",   source: "dealers",       target: "us_fbo",                 color: "orange", seriesIds: [],          label: "" },
  { id: "orange_finins_corpoff",  source: "foreign_insurers", target: "corporates_offshore",  color: "orange", seriesIds: [],          label: "" },
  { id: "orange_offmmf_fbank",    source: "offshore_mmf",   target: "foreign_banks",          color: "orange", seriesIds: [],          label: "" },
  { id: "orange_fcboff_usfbo",    source: "fcb_swf_supra_offshore", target: "us_fbo",        color: "orange", seriesIds: [],          label: "" },

  // ── Pink ────────────────────────────────────────────────────────────
  { id: "pink_fbank_primemmf",    source: "foreign_banks",  target: "prime_mmf",              color: "pink", seriesIds: [],            label: "" },
];

// ── Glossary ────────────────────────────────────────────────────────────
export const GLOSSARY = [
  { term: "Agency MBS",       definition: "Mortgage-backed securities issued by GSEs such as Fannie Mae or Freddie Mac." },
  { term: "DFMU",             definition: "Designated financial market utility, such as the Clearing House Payments Company or the Chicago Mercantile Exchange." },
  { term: "Eurodollars",      definition: "U.S. dollar-denominated deposits at foreign banks or branches of U.S. banks outside of the United States." },
  { term: "Fannie",           definition: "The Federal National Mortgage Association, commonly known as Fannie Mae." },
  { term: "FCB",              definition: "Foreign central bank." },
  { term: "FHLB",             definition: "Federal Home Loan Bank — a U.S. GSE that lends to member depository institutions." },
  { term: "Foreign repo pool",definition: "Overnight U.S. dollar investment service that the Federal Reserve offers to foreign official and international accounts." },
  { term: "Freddie",          definition: "The Federal Home Loan Mortgage Corporation, commonly known as Freddie Mac." },
  { term: "GSEs",             definition: "Government-sponsored enterprises, such as Fannie Mae, Freddie Mac, and the Federal Home Loan Banks." },
  { term: "MBS",              definition: "Mortgage-backed securities guaranteed by Fannie Mae, Freddie Mac, or Ginnie Mae." },
  { term: "ON RRP",           definition: "Overnight Reverse Repurchase Agreement Facility operated by the Federal Reserve." },
  { term: "Supra",            definition: "Supranational organization, such as the International Monetary Fund or the United Nations." },
  { term: "SWF",              definition: "Sovereign wealth fund." },
  { term: "TGA",              definition: "Treasury General Account — the U.S. government's operating account at the Federal Reserve." },
];
