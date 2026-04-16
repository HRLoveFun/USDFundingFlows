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

// ── Grid-based connection ports per shape type ───────────────────────────
// Each port is an {x, y} offset from the shape center, computed as the
// intersection of the shape boundary with a 10px grid. This yields many
// more candidate ports than the old hand-picked list, enabling the edge
// router to find shorter, overlap-free connections.
const GRID = 10;  // grid resolution in SVG px

/** Deduplicate ports within ±1px to avoid near-duplicates from rounding. */
function dedupPorts(pts) {
  const out = [];
  for (const p of pts) {
    if (!out.some(q => Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1)) {
      out.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    }
  }
  return out;
}

/** Rectangle / bs_parent / bs_child grid ports. */
function rectGridPorts(w, h) {
  const hw = w / 2, hh = h / 2;
  const pts = [];
  // Top & bottom edges: every GRID px along x
  for (let x = Math.ceil(-hw / GRID) * GRID; x <= hw; x += GRID) {
    pts.push({ x, y: -hh });
    pts.push({ x, y:  hh });
  }
  // Left & right edges: every GRID px along y
  for (let y = Math.ceil(-hh / GRID) * GRID; y <= hh; y += GRID) {
    pts.push({ x: -hw, y });
    pts.push({ x:  hw, y });
  }
  // Always include the 4 corners
  pts.push({ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh });
  return dedupPorts(pts);
}

/** Hexagon grid ports — intersect 6 edges with horizontal/vertical grid lines. */
function hexGridPorts(rx, ry) {
  // 6 vertices
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    verts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  const pts = [...verts]; // always include vertices
  // For each segment, find grid crossings
  for (let i = 0; i < 6; i++) {
    const A = verts[i], B = verts[(i + 1) % 6];
    const dx = B.x - A.x, dy = B.y - A.y;
    // Horizontal grid lines crossing this segment
    if (Math.abs(dy) > 0.01) {
      const yMin = Math.min(A.y, B.y), yMax = Math.max(A.y, B.y);
      for (let gy = Math.ceil(yMin / GRID) * GRID; gy <= yMax; gy += GRID) {
        const t = (gy - A.y) / dy;
        if (t >= 0 && t <= 1) pts.push({ x: A.x + t * dx, y: gy });
      }
    }
    // Vertical grid lines crossing this segment
    if (Math.abs(dx) > 0.01) {
      const xMin = Math.min(A.x, B.x), xMax = Math.max(A.x, B.x);
      for (let gx = Math.ceil(xMin / GRID) * GRID; gx <= xMax; gx += GRID) {
        const t = (gx - A.x) / dx;
        if (t >= 0 && t <= 1) pts.push({ x: gx, y: A.y + t * dy });
      }
    }
  }
  return dedupPorts(pts);
}

/** Ellipse grid ports — solve for grid-line intersections analytically. */
function ellipseGridPorts(rx, ry) {
  const pts = [];
  // Horizontal grid lines: y = k  →  x = ±rx·√(1 - (k/ry)²)
  for (let k = Math.ceil(-ry / GRID) * GRID; k <= ry; k += GRID) {
    const ratio = k / ry;
    if (Math.abs(ratio) > 1) continue;
    const xVal = rx * Math.sqrt(1 - ratio * ratio);
    pts.push({ x:  xVal, y: k });
    pts.push({ x: -xVal, y: k });
  }
  // Vertical grid lines: x = k  →  y = ±ry·√(1 - (k/rx)²)
  for (let k = Math.ceil(-rx / GRID) * GRID; k <= rx; k += GRID) {
    const ratio = k / rx;
    if (Math.abs(ratio) > 1) continue;
    const yVal = ry * Math.sqrt(1 - ratio * ratio);
    pts.push({ x: k, y:  yVal });
    pts.push({ x: k, y: -yVal });
  }
  // Cardinal points
  pts.push({ x: rx, y: 0 }, { x: -rx, y: 0 }, { x: 0, y: ry }, { x: 0, y: -ry });
  return dedupPorts(pts);
}

export const SHAPE_PORTS = {
  hexagon:   hexGridPorts(SHAPE_SIZES.hexagon.rx, SHAPE_SIZES.hexagon.ry),
  circle:    ellipseGridPorts(SHAPE_SIZES.circle.rx, SHAPE_SIZES.circle.ry),
  rectangle: rectGridPorts(SHAPE_SIZES.rectangle.width, SHAPE_SIZES.rectangle.height),
  bs_parent: rectGridPorts(SHAPE_SIZES.bs_parent.width, SHAPE_SIZES.bs_parent.height),
  bs_child:  rectGridPorts(SHAPE_SIZES.bs_child.width, SHAPE_SIZES.bs_child.height),
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

  // ── Magenta: Securities purchases (from market regions to U.S. Gov Entities) ──
  // Source = section/dashed-box ID (connects from region edge), Target = node or region
  { id: "magenta_banksdealers_govent",   source: "sec:banks_dealers",    target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_onshoreinv_govent",     source: "sec:onshore_inv",      target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_offshore_govent",       source: "sec:offshore",         target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_dashedgse_ustreas",     source: "sec:dash_gse_pair",    target: "us_treasury",      color: "magenta", seriesIds: [], label: "" },

  // ── Fed balance sheet asset outflows ───────────────────────────────
  { id: "red_primarycred_usbanks",source: "bs_primary_credit", target: "us_banks",             color: "red",    seriesIds: [],          label: "Primary Credit" },
  { id: "purple_cbswaps_fcboff",  source: "bs_cb_swaps",     target: "fcb_swf_supra_offshore", color: "purple", seriesIds: ["SWPT"],    label: "CB Swaps" },

  // ── Fed balance sheet liability links ─────────────────────────────
  { id: "red_fhlbdep_fhlb",       source: "bs_fhlb_deposits", target: "fhlb",                  color: "red",    seriesIds: [],          label: "" },
  { id: "red_resbal_usfbo",       source: "bs_reserve_balances", target: "us_fbo",             color: "red",    seriesIds: [],          label: "" },

  // ── Light green: Fed funds lending ────────────────────────────────
  { id: "light_green_fhlb_usbanks", source: "fhlb",          target: "us_banks",               color: "light_green", seriesIds: [],     label: "" },

  // ── Brown: FHLB advances (reverse direction) ─────────────────────
  { id: "brown_fhlb_usbanks",     source: "fhlb",            target: "us_banks",               color: "brown", seriesIds: [],           label: "" },
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
