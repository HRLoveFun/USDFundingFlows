/**
 * constants.js — Core configuration for the U.S. Dollar Funding Flows diagram.
 * Left-right layout: Federal Reserve (left) || U.S. Dollar Funding Market (right).
 * 28 entity nodes, ~65 edges, 8 arrow color types.
 */

// ── Viewbox dimensions ──────────────────────────────────────────────────
export const WIDTH = 2150;
export const HEIGHT = 1280;

// ── Shape types ─────────────────────────────────────────────────────────
export const SHAPE = {
  HEXAGON:   "hexagon",    // Banks & Dealers
  CIRCLE:    "circle",     // Investors, funds, corporates, insurers
  RECTANGLE: "rectangle",  // U.S. Treasury
  BS_PARENT: "bs_parent",  // Balance sheet group item (parent)
  BS_CHILD:  "bs_child",   // Balance sheet sub-group item (child)
};

// ── Shape fill colors ───────────────────────────────────────────────────
export const SHAPE_COLORS = {
  hexagon:   "#5C6BC0",  // indigo (intermediary institutions)
  circle:    "#26A69A",  // teal (investor institutions)
  rectangle: "#607D8B",  // blue-gray (government)
};

// ── Shape sizing ────────────────────────────────────────────────────────
export const SHAPE_SIZES = {
  hexagon:   { rx: 110, ry: 38 },
  circle:    { rx: 102, ry: 36 },
  rectangle: { width: 155, height: 58 },
  bs_parent: { width: 190, height: 28 },
  bs_child:  { width: 175, height: 26 },
};

// ── Connection ports per shape type ──────────────────────────────────────
// Each port is an {x, y} offset from the shape center.
// Ports are ordered around the perimeter; the edge router assigns unique ports
// so that each connection point serves at most one edge.
export const SHAPE_PORTS = {
  /** Long hexagon: 12 ports — vertices + edge midpoints */
  hexagon: (() => {
    const rx = SHAPE_SIZES.hexagon.rx;
    const ry = SHAPE_SIZES.hexagon.ry;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      // Vertex
      pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a), angle: a });
      // Edge midpoint (half-step)
      const ma = (Math.PI / 3) * (i + 0.5);
      pts.push({ x: rx * Math.cos(ma), y: ry * Math.sin(ma), angle: ma });
    }
    return pts;
  })(),
  /** Ellipse: 16 ports — evenly spaced around elliptical circumference */
  circle: (() => {
    const rx = SHAPE_SIZES.circle.rx;
    const ry = SHAPE_SIZES.circle.ry;
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI / 16) * i;
      pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a), angle: a });
    }
    return pts;
  })(),
  /** Rectangle: 14 ports — 4 corners + distributed along each edge */
  rectangle: (() => {
    const w = SHAPE_SIZES.rectangle.width / 2;
    const h = SHAPE_SIZES.rectangle.height / 2;
    // Order: top(L→R), right(T→B), bottom(R→L), left(B→T)
    return [
      { x: -w + w/3, y: -h, angle: -Math.PI/2 },     // top-left third
      { x:          0, y: -h, angle: -Math.PI/2 },     // top-center
      { x:  w - w/3, y: -h, angle: -Math.PI/2 },       // top-right third
      { x:  w, y: -h + h/2, angle: 0 },                // right-top half
      { x:  w, y:  h/2,       angle: 0 },              // right-bottom half
      { x:  w - w/3, y:  h, angle: Math.PI/2 },        // bottom-right third
      { x:          0, y:  h, angle: Math.PI/2 },      // bottom-center
      { x: -w + w/3, y:  h, angle: Math.PI/2 },        // bottom-left third
      { x: -w, y:  h/2,       angle: Math.PI },        // left-bottom half
      { x: -w, y: -h + h/2, angle: Math.PI },          // left-top half
      // Extra corner ports for high-degree nodes
      { x: -w, y: -h, angle: -3*Math.PI/4 },           // top-left corner
      { x:  w, y: -h, angle: -Math.PI/4 },             // top-right corner
      { x:  w, y:  h, angle: Math.PI/4 },              // bottom-right corner
      { x: -w, y:  h, angle: 3*Math.PI/4 },            // bottom-left corner
    ];
  })(),
  /** bs_parent: 10 ports — wide rectangle */
  bs_parent: (() => {
    const w = SHAPE_SIZES.bs_parent.width / 2;
    const h = SHAPE_SIZES.bs_parent.height / 2;
    return [
      { x: -w*0.6, y: -h, angle: -Math.PI/2 },
      { x:      0,  y: -h, angle: -Math.PI/2 },
      { x:  w*0.6, y: -h, angle: -Math.PI/2 },
      { x:  w, y: 0,  angle: 0 },
      { x:  w*0.6, y:  h, angle: Math.PI/2 },
      { x:      0,  y:  h, angle: Math.PI/2 },
      { x: -w*0.6, y:  h, angle: Math.PI/2 },
      { x: -w, y: 0,  angle: Math.PI },
      // corners
      { x: -w, y: -h, angle: -3*Math.PI/4 },
      { x:  w, y: -h, angle: -Math.PI/4 },
    ];
  })(),
  /** bs_child: 8 ports — narrow rectangle */
  bs_child: (() => {
    const w = SHAPE_SIZES.bs_child.width / 2;
    const h = SHAPE_SIZES.bs_child.height / 2;
    return [
      { x: -w*0.5, y: -h, angle: -Math.PI/2 },
      { x:       0, y: -h, angle: -Math.PI/2 },
      { x:  w*0.5, y: -h, angle: -Math.PI/2 },
      { x:  w, y: 0,  angle: 0 },
      { x:  w*0.5, y:  h, angle: Math.PI/2 },
      { x:       0, y:  h, angle: Math.PI/2 },
      { x: -w*0.5, y:  h, angle: Math.PI/2 },
      { x: -w, y: 0,  angle: Math.PI },
    ];
  })(),
};

// ── Node category colors (for sidebar legend) ───────────────────────────
export const CATEGORY_COLORS = {
  hexagon:   "#5C6BC0",
  circle:    "#26A69A",
  rectangle: "#607D8B",
  bs_parent: "#E3F2FD",
  bs_child:  "#FFF8E1",
};

// ── Arrow / edge color definitions ──────────────────────────────────────
export const EDGE_COLORS = {
  green:       { color: "#4CAF50", name: "Commercial paper" },
  pink:        { color: "#E91E63", name: "Eurodollar lending" },
  brown:       { color: "#795548", name: "Federal Home Loan Bank advances" },
  light_green: { color: "#8BC34A", name: "Fed funds lending" },
  red:         { color: "#E53935", name: "Fed reserve account deposits" },
  purple:      { color: "#9C27B0", name: "Foreign exchange swaps: U.S dollar swaps for foreign currency" },
  cyan:        { color: "#00BCD4", name: "Reverse repurchase agreement facility usage" },
  magenta:     { color: "#E040FB", name: "Securities purchases from Treasury and government-sponsored enterprises" },
  gold:        { color: "#FFB300", name: "U.S. dollar deposits (including certificates of deposit, overnight and time deposits)" },
  black:       { color: "#424242", name: "U.S. dollar repo investments" },
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
  { id: "fed",         label: "FEDERAL RESERVE",             x: 20,   y: 10,   w: 500,  h: 1220, style: "header" },
  { id: "bs",          label: "BALANCE SHEET",               x: 35,   y: 55,   w: 470, h: 1175, style: "subheader" },

  // ── RIGHT PANEL: U.S. DOLLAR FUNDING MARKET ──────────────────────────
  { id: "market",      label: "U.S. DOLLAR FUNDING MARKET",  x: 540,  y: 10,   w: 1600, h: 1220, style: "header" },
  { id: "onshore",     label: "ONSHORE ENTITIES",            x: 560,  y: 55,   w: 940,  h: 1175, style: "subheader" },
  { id: "offshore",    label: "OFFSHORE ENTITIES",           x: 1520, y: 55,   w: 610,  h: 1175, style: "subheader" },

  // Onshore sub-groups (matching reference image hierarchy)
  { id: "banks_dealers",    label: "Banks and Dealers",           x: 575,  y: 95,   w: 905,  h: 300,  style: "group" },
  { id: "onshore_inv",      label: "Onshore Investors",           x: 575,  y: 420,  w: 905,  h: 520,  style: "group" },
  // Dashed boxes inside Onshore area — unified gray color, precisely wrapping contained shapes (+12px padding)
  // Box 1: U.S. Banks(848±110) + U.S. Branches(1208±110) — hexagon rx=110, ry=38
  { id: "dash_banks_pair",       label: "",  x: 726, y: 147, w: 604, h: 98, style: "dashed_gray" },
  // Box 2: Gov MMF(878±102) + Prime MMF(1178±102) — circle rx=102, ry=36
  { id: "dash_mmf_row",          label: "",  x: 754, y: 574, w: 548, h: 112,style: "dashed_gray" },
  // Box 3: Securities Lenders + Corporates(Row3) + FCBs/SWFs + Hedge Funds(Row4) — circles rx=102, ry=36
  { id: "dash_investor_group",   label: "",  x: 754, y: 699, w: 548, h: 231,style: "dashed_gray" },
  // Box 4: FHLB(753±110) + GSEs(1028±110) — hexagon rx=110, ry=38
  { id: "dash_gse_pair",         label: "",  x: 621, y: 1007,w: 539, h: 116,style: "dashed_gray" },
  { id: "gov_entities",     label: "U.S. Government Entities",    x: 575,  y: 965,  w: 905,  h: 230,  style: "group" },
  // Offshore sub-groups — wraps 3 nodes: Foreign Insurers(y=350), Foreign Banks(y=560), Corporates(y=785)
  { id: "offshore_investors", label: "",  x: 1698, y: 300, w: 244, h: 535, style: "dashed_gray" },
];

// ── Text annotations (column headers, hierarchy labels) ─────────────────
// Typography controlled by CSS: text.annotation → var(--fs-sub-group)/var(--fw-sub-group)
export const ANNOTATIONS = [
  { text: "Assets",            x: 125, y: 95 },
  { text: "Liabilities",       x: 355, y: 95 },
];

// ── 28 Entity Nodes ─────────────────────────────────────────────────────
// Layout: LEFT = Federal Reserve | RIGHT = U.S. Dollar Funding Market

export const NODES = [
  // ════════════════════════════════════════════════════════════════════
  // LEFT PANEL — FEDERAL RESERVE / BALANCE SHEET
  // ════════════════════════════════════════════════════════════════════

  // ── Balance Sheet — Assets (资产端, 左列) ────────────────────────────
  { id: "bs_treasuries",      label: "U.S. Treasury Securities",                        x: 125,  y: 118,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_agency_mbs",      label: "Agency Debt and MBS Securities",                   x: 125,  y: 165,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_primary_credit",  label: "Primary Credit Facility",                          x: 125,  y: 212,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_cb_swaps",        label: "Central Bank U.S. Dollar Liquidity Swaps",         x: 125,  y: 259,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_foreign_reserves",label: "Foreign Reserves",                                 x: 125,  y: 306,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_others_assets",   label: "Others",                                           x: 125,  y: 353,  shape: "bs_parent", group: "bs_assets" },

  // ── Balance Sheet — Liabilities (负债端, 右列) ───────────────────────
  { id: "bs_reserve_balances", label: "Reserve Balances (from depository institutions)",  x: 355,  y: 118,  shape: "bs_parent", group: "bs_liabilities" },
  { id: "bs_fed_notes",        label: "Federal Reserve Notes (currency in circulation)",  x: 355,  y: 165,  shape: "bs_parent", group: "bs_liabilities" },
  // RRP — group parent item
  { id: "bs_rrp",              label: "Reverse Repurchase Agreements",                    x: 355,  y: 212,  shape: "bs_parent", group: "bs_liabilities" },
  // RRP — sub-group children (indented, parentId links to parent)
  { id: "bs_rrp_omo",          label: "Open market operations",                           x: 372,  y: 256,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_rrp" },
  { id: "bs_foreign_repo",     label: "Foreign repo pool",                                 x: 372,  y: 298,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_rrp" },
  // Other Liabilities — group parent item
  { id: "bs_other_liab",       label: "Other Liabilities",                                x: 355,  y: 345,  shape: "bs_parent", group: "bs_liabilities" },
  // Deposits — sub-group children (indented, parentId links to parent)
  { id: "bs_tga",             label: "U.S. Treasury General Account (TGA)",             x: 372,  y: 391,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_other_liab" },
  { id: "bs_fhlb_deposits",    label: "FHLB, DFMU, and other deposits",                   x: 372,  y: 433,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_other_liab" },

  // ════════════════════════════════════════════════════════════════════
  // RIGHT PANEL — U.S. DOLLAR FUNDING MARKET
  // ════════════════════════════════════════════════════════════════════

  // ── Banks and Dealers (onshore upper area) ──
  // Row 1: two hexagons side-by-side (vertically aligned), centered in group
  { id: "us_banks",    label: "U.S. Banks",                              x: 848,  y: 195,  shape: "hexagon",  group: "banks_dealers" },
  { id: "us_fbo",      label: "U.S. Branches of\nForeign Banks",         x: 1208, y: 195,  shape: "hexagon",  group: "banks_dealers" },
  // Row 2: single hexagon (horizontally centered)
  { id: "dealers",     label: "Dealers",                                  x: 1028, y: 320,  shape: "hexagon", group: "banks_dealers" },

  // ── Onshore Investors (middle area, 4-row layout) ──
  // Row 1: single circle (horizontally centered in group)
  { id: "retail_investors",      label: "Retail\nInvestors",             x: 1028, y: 525, shape: "circle",   group: "onshore_inv" },
  // Row 2: Gov MMF + Prime MMF (inside dashed box, vertically aligned — same x for alignment)
  { id: "gov_mmf",               label: "Government\nMoney Market Funds", x: 878,  y: 630,  shape: "circle",   group: "onshore_inv" },
  { id: "prime_mmf",             label: "Prime Money\nMarket Funds",     x: 1178, y: 630,  shape: "circle",   group: "onshore_inv" },
  // Row 3: Securities Lenders + Corporates (inside dashed box, vertically aligned — same x for alignment)
  { id: "securities_lenders",    label: "Securities\nLenders",          x: 878,  y: 755,  shape: "circle",   group: "onshore_inv" },
  { id: "corporates_onshore",    label: "Corporates",                    x: 1178, y: 755,  shape: "circle",   group: "onshore_inv" },
  // Row 4: FCBs/SWFs/Supras + Hedge Funds (inside dashed box, vertically aligned — same x for alignment)
  { id: "fcb_swf_supra_onshore", label: "FCBs, SWFs,\nSupras",         x: 878,  y: 880,  shape: "circle",   group: "onshore_inv" },
  { id: "hedge_funds",           label: "Hedge Funds &\nOther Managers", x: 1178, y: 880,  shape: "circle",   group: "onshore_inv" },

  // ── U.S. Government Entities (lower onshore area, 3 shapes in one row) ──
  // Row: three shapes horizontally centered in group, vertically aligned
  { id: "fhlb",         label: "Federal Home\nLoan Banks",               x: 753,  y: 1065, shape: "hexagon",  group: "gov_entities" },
  { id: "gse",          label: "Fannie, Freddie,\nand other GSEs",      x: 1028, y: 1065, shape: "hexagon",  group: "gov_entities" },
  { id: "us_treasury",  label: "U.S. Treasury",                          x: 1303, y: 1065, shape: "rectangle", group: "gov_entities" },

  // ── Offshore Entities (far right single column) ──
  // Reference: vertical stack matching the rightmost column in image
  { id: "fcb_swf_supra_offshore", label: "Foreign Central Banks (FCBs),\nSovereign Wealth Funds (SWFs),\nand Supranational Organizations (supras)",
                                                                                       x: 1820, y: 150,  shape: "circle",   group: "offshore" },
  { id: "foreign_insurers",       label: "Foreign Insurers &\nOther Money Managers",
                                                                                       x: 1820, y: 350,  shape: "circle",   group: "offshore" },
  { id: "foreign_banks",          label: "Foreign Banks &\nForeign Branches\nof U.S. Banks",
                                                                                       x: 1820, y: 560,  shape: "hexagon", group: "offshore" },
  { id: "corporates_offshore",    label: "Corporates",                    x: 1820, y: 785,  shape: "circle",   group: "offshore" },
  { id: "offshore_mmf",           label: "Offshore Money\nMarket Funds", x: 1820, y: 1010, shape: "circle",   group: "offshore" },
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

  // ── Gold (U.S. dollar deposits) ─────────────────────────────────────────
  { id: "gold_dealers_usfbo",     source: "dealers",       target: "us_fbo",                 color: "gold",   seriesIds: [],          label: "" },
  { id: "gold_finins_corpoff",    source: "foreign_insurers", target: "corporates_offshore",  color: "gold",   seriesIds: [],          label: "" },
  { id: "gold_offmmf_fbank",      source: "offshore_mmf",   target: "foreign_banks",          color: "gold",   seriesIds: [],          label: "" },
  { id: "gold_fcboff_usfbo",      source: "fcb_swf_supra_offshore", target: "us_fbo",         color: "gold",   seriesIds: [],          label: "" },

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
