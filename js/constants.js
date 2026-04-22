/**
 * constants.js — Data definitions for the U.S. Dollar Funding Flows diagram.
 * Layout constants are centralized in config.js and re-exported here for
 * backward compatibility.
 */

import {
  CANVAS,
  GRID,
  SHAPE_TYPES,
  SHAPE_COLORS,
  SHAPE_SIZES,
  CATEGORY_COLORS,
  EDGE_COLORS,
  EDGE_CONNECTION_TYPES,
  NODE_TEXT,
} from "./config.js";

// Re-export layout constants so existing imports continue to work
export const WIDTH = CANVAS.WIDTH;
export const HEIGHT = CANVAS.HEIGHT;
export { GRID, SHAPE_COLORS, SHAPE_SIZES, CATEGORY_COLORS, EDGE_COLORS, EDGE_CONNECTION_TYPES };
export const SHAPE = SHAPE_TYPES;

// ── Grid-based connection ports per shape type ───────────────────────────
// Each port is an {x, y} offset from the shape center, computed as the
// intersection of the shape boundary with a 10px grid. This yields many
// more candidate ports than the old hand-picked list, enabling the edge
// router to find shorter, overlap-free connections.

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

// ── Transaction Types (mapped from EDGE_COLORS for sidebar/tooltip compat) ─
export const TRANSACTION_TYPES = Object.entries(EDGE_COLORS).map(([id, cfg]) => ({
  id,
  name: cfg.name,
  color: cfg.color,
  dash: "",
}));

function buildSectionEndpoints(x, y, w, h) {
  return {
    top: { x: x + w / 2, y },
    right: { x: x + w, y: y + h / 2 },
    bottom: { x: x + w / 2, y: y + h },
    left: { x, y: y + h / 2 },
  };
}

// ── Section / group definitions (rendered as background rectangles) ─────
// Left-right layout: Federal Reserve (left) || U.S. Dollar Funding Market (right)
export const SECTIONS = [
  // ── LEFT PANEL: FEDERAL RESERVE ──────────────────────────────────────
  { id: "fed",         label: "FEDERAL RESERVE",             x: 20,   y: 10,   w: 500,  h: 1220, style: "header", level: 1, endpoints: buildSectionEndpoints(20, 10, 500, 1220) },
  { id: "bs",          label: "BALANCE SHEET",               x: 35,   y: 55,   w: 470, h: 1175, style: "subheader", level: 2, endpoints: buildSectionEndpoints(35, 55, 470, 1175) },

  // ── RIGHT PANEL: U.S. DOLLAR FUNDING MARKET ──────────────────────────
  { id: "market",      label: "U.S. DOLLAR FUNDING MARKET",  x: 540,  y: 10,   w: 1420, h: 1220, style: "header", level: 1, endpoints: buildSectionEndpoints(540, 10, 1420, 1220) },
  { id: "onshore",     label: "ONSHORE ENTITIES",            x: 560,  y: 55,   w: 940,  h: 1175, style: "subheader", level: 2, endpoints: buildSectionEndpoints(560, 55, 940, 1175) },
  { id: "offshore",    label: "OFFSHORE ENTITIES",           x: 1550, y: 55,   w: 260,  h: 1175, style: "subheader", level: 2, endpoints: buildSectionEndpoints(1550, 55, 260, 1175) },

  // Onshore sub-groups (matching reference image hierarchy)
  { id: "banks_dealers",    label: "Banks and Dealers",           x: 575,  y: 95,   w: 905,  h: 300,  style: "group", level: 3, endpoints: buildSectionEndpoints(575, 95, 905, 300) },
  { id: "onshore_inv",      label: "Onshore Investors",           x: 575,  y: 420,  w: 905,  h: 520,  style: "group", level: 3, endpoints: buildSectionEndpoints(575, 420, 905, 520) },
  // Dashed boxes inside Onshore area — unified gray color, precisely wrapping contained shapes (+12px padding)
  // Box 1: U.S. Banks(848±110) + U.S. Branches(1208±110) — hexagon rx=110, ry=38
  { id: "dash_banks_pair",       label: "",  x: 726, y: 147, w: 604, h: 98, style: "dashed_gray", level: 4, endpoints: buildSectionEndpoints(726, 147, 604, 98) },
  // Box 2: Gov MMF(878±102) + Prime MMF(1178±102) — circle rx=102, ry=36
  { id: "dash_mmf_row",          label: "",  x: 754, y: 574, w: 548, h: 112,style: "dashed_gray", level: 4, endpoints: buildSectionEndpoints(754, 574, 548, 112) },
  // Box 3: Securities Lenders + Corporates(Row3) + FCBs/SWFs + Hedge Funds(Row4) — circles rx=102, ry=36
  { id: "dash_investor_group",   label: "",  x: 754, y: 699, w: 548, h: 231,style: "dashed_gray", level: 4, endpoints: buildSectionEndpoints(754, 699, 548, 231) },
  // Box 4: FHLB(753±110) + GSEs(1028±110) — hexagon rx=110, ry=38
  { id: "dash_gse_pair",         label: "",  x: 621, y: 1007,w: 539, h: 116,style: "dashed_gray", level: 4, endpoints: buildSectionEndpoints(621, 1007, 539, 116) },
  { id: "gov_entities",     label: "U.S. Government Entities",    x: 575,  y: 965,  w: 905,  h: 230,  style: "group", level: 3, endpoints: buildSectionEndpoints(575, 965, 905, 230) },
  // Offshore sub-groups — wraps 3 nodes: Foreign Insurers(y=350), Foreign Banks(y=560), Corporates(y=785)
  { id: "offshore_investors", label: "",  x: 1560, y: 300, w: 240, h: 535, style: "dashed_gray", level: 3, endpoints: buildSectionEndpoints(1560, 300, 240, 535) },
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
  { id: "bs_treasuries",      label: "U.S. Treasury Securities",                        x: 125,  y: 220,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_agency_mbs",      label: "Agency Debt and MBS Securities",                   x: 125,  y: 290,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_primary_credit",  label: "Primary Credit Facility",                          x: 125,  y: 360,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_cb_swaps",        label: "Central Bank U.S. Dollar Liquidity Swaps",         x: 125,  y: 430,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_foreign_reserves",label: "Foreign Reserves",                                 x: 125,  y: 500,  shape: "bs_parent", group: "bs_assets" },
  { id: "bs_others_assets",   label: "Others",                                           x: 125,  y: 570,  shape: "bs_parent", group: "bs_assets" },

  // ── Balance Sheet — Liabilities (负债端, 右列) ───────────────────────
  { id: "bs_reserve_balances", label: "Reserve Balances (from depository institutions)",  x: 355,  y: 220,  shape: "bs_parent", group: "bs_liabilities" },
  { id: "bs_fed_notes",        label: "Federal Reserve Notes (currency in circulation)",  x: 355,  y: 290,  shape: "bs_parent", group: "bs_liabilities" },
  // RRP — group parent + children
  { id: "bs_rrp",              label: "Reverse Repurchase Agreements",                    x: 355,  y: 360,  shape: "bs_parent", group: "bs_liabilities" },
  { id: "bs_rrp_omo",          label: "Open market operations",                           x: 372,  y: 425,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_rrp" },
  { id: "bs_foreign_repo",     label: "Foreign repo pool",                                 x: 372,  y: 485,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_rrp" },
  // Other Liabilities — group parent + children
  { id: "bs_other_liab",       label: "Other Liabilities",                                x: 355,  y: 430,  shape: "bs_parent", group: "bs_liabilities" },
  { id: "bs_tga",             label: "U.S. Treasury General Account (TGA)",             x: 372,  y: 495,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_other_liab" },
  { id: "bs_fhlb_deposits",    label: "FHLB, DFMU, and other deposits",                   x: 372,  y: 555,  shape: "bs_child",  group: "bs_liabilities", parentId: "bs_other_liab" },

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
                                                                                       x: 1680, y: 150,  shape: "circle",   group: "offshore" },
  { id: "foreign_insurers",       label: "Foreign Insurers &\nOther Money Managers",
                                                                                       x: 1680, y: 350,  shape: "circle",   group: "offshore" },
  { id: "foreign_banks",          label: "Foreign Banks &\nForeign Branches\nof U.S. Banks",
                                                                                       x: 1680, y: 560,  shape: "hexagon", group: "offshore" },
  { id: "corporates_offshore",    label: "Corporates",                    x: 1680, y: 785,  shape: "circle",   group: "offshore" },
  { id: "offshore_mmf",           label: "Offshore Money\nMarket Funds", x: 1680, y: 1010, shape: "circle",   group: "offshore" },
];

// ── ~49 Edge definitions (directed flows) ───────────────────────────────
// color: arrow color key from EDGE_COLORS
// seriesIds: FRED series to display on this edge
// connectionType: "self" = loop on one shape, "connected" = line between two shapes
export const EDGES = [
  // ── Red | Fed reserve account deposits ────────────────────────────────
  { id: "red_banksdealers_resbal", source: "sec:dash_banks_pair", target: "bs_reserve_balances", color: "red", seriesIds: ["WRESBAL"], label: "Reserve Balances" },
  { id: "red_govent_otherliab",    source: "sec:gov_entities",  target: "bs_other_liab",       color: "red", seriesIds: [],         label: "Other Liabilities" },

  // ── Brown | Federal Home Loan Bank advances ───────────────────────────
  { id: "brown_usbanks_fhlb",   source: "fhlb",      target: "us_banks",          color: "brown", seriesIds: [],                  label: "" },

  // ── Cyan | Reverse repurchase agreement facility usage ─────────────────
  { id: "cyan_banksdealers_rrp",  source: "sec:banks_dealers",     target: "bs_rrp", color: "cyan", seriesIds: [], label: "" },
  { id: "cyan_dashmmf_rrp",       source: "sec:dash_mmf_row",      target: "bs_rrp", color: "cyan", seriesIds: [], label: "" },
  { id: "cyan_fcbonswfsupra_rrp", source: "fcb_swf_supra_onshore", target: "bs_foreign_repo", color: "cyan", seriesIds: [], label: "" },
  { id: "cyan_dashgse_rrp",       source: "sec:dash_gse_pair",     target: "bs_rrp_omo",      color: "cyan", seriesIds: [], label: "" },

  // ── Green | Commercial paper ───────────────────────────────────────────
  { id: "green_primemmf_corp",   source: "prime_mmf",     target: "corporates_onshore",      color: "green", seriesIds: ["COMPAPER"], label: "" },
  { id: "green_seclend_corp",    source: "securities_lenders", target: "corporates_onshore",  color: "green", seriesIds: [],           label: "" },
  { id: "green_fcbon_corp",      source: "fcb_swf_supra_onshore", target: "corporates_onshore", color: "green", seriesIds: [],        label: "" },
  { id: "green_hedge_corp",      source: "hedge_funds", target: "corporates_onshore",         color: "green", seriesIds: [],           label: "" },
  { id: "green_fcboff_fbank",    source: "fcb_swf_supra_offshore", target: "foreign_banks",    color: "green", seriesIds: [],          label: "" },
  { id: "green_offmmf_fbank",    source: "offshore_mmf", target: "foreign_banks",         color: "green", seriesIds: [],           label: "" },
  { id: "green_fbank_finin",   source: "foreign_banks",  target: "foreign_insurers",     color: "green", seriesIds: [],           label: "" },
  { id: "green_corpoff_fbank",   source: "corporates_offshore", target: "foreign_banks",      color: "green", seriesIds: [],           label: "" },
  { id: "green_offmmf_corpoff",  source: "offshore_mmf",   target: "corporates_offshore",     color: "green", seriesIds: [],           label: "" },
  // Onshore / Offshore section -> dashed box wrapping U.S. Banks pair
  { id: "green_onshoreinv_banks", source: "sec:onshore_inv", target: "sec:dash_banks_pair", color: "green", seriesIds: [], label: "" },
  { id: "green_offshore_banks",   source: "sec:offshore",    target: "sec:dash_banks_pair", color: "green", seriesIds: [], label: "" },

  // ── Black | U.S. dollar repo investments ───────────────────────────────
  { id: "black_usbanks_dealers", source: "us_banks",      target: "dealers",                 color: "black", seriesIds: [],           label: "", connectionType: EDGE_CONNECTION_TYPES.BIDIRECTIONAL },
  { id: "black_usfbo_dealers",   source: "us_fbo",        target: "dealers",                 color: "black", seriesIds: [],           label: "", connectionType: EDGE_CONNECTION_TYPES.BIDIRECTIONAL },
  { id: "black_dealers_hedge",   source: "dealers",    target: "hedge_funds",                 color: "black", seriesIds: [],           label: "" },
  { id: "black_dashgse_banksdealers", source: "sec:dash_gse_pair", target: "sec:banks_dealers", color: "black", seriesIds: [], label: "" },
  { id: "black_offshore_banksdealers", source: "sec:offshore", target: "sec:banks_dealers", color: "black", seriesIds: [], label: "" },
  { id: "black_onshoreinv_banksdealers", source: "sec:onshore_inv", target: "sec:banks_dealers", color: "black", seriesIds: [], label: "" },

  // ── Purple | Foreign exchange swaps: U.S dollar swaps for foreign currency ─
  { id: "purple_usbanks_usfbo",  source: "us_banks",     target: "us_fbo",                  color: "purple", seriesIds: [],          label: "", connectionType: EDGE_CONNECTION_TYPES.BIDIRECTIONAL },
  { id: "purple_hedge_offshoreinv",  source: "hedge_funds",            target: "sec:offshore_investors", color: "purple", seriesIds: [], label: "" },
  { id: "purple_dashbanks_offshoreinv", source: "sec:dash_banks_pair", target: "sec:offshore_investors", color: "purple", seriesIds: [], label: "" },
  { id: "purple_fcboff_offshoreinv", source: "fcb_swf_supra_offshore", target: "sec:offshore_investors", color: "purple", seriesIds: [], label: "" },
  { id: "purple_fbank_corpoff",    source: "foreign_banks",          target: "corporates_offshore",    color: "purple", seriesIds: [], label: "" },
  { id: "purple_fbank_finins",     source: "foreign_banks",          target: "foreign_insurers",       color: "purple", seriesIds: [], label: "" },


  // ── Gold | U.S. dollar deposits (including certificates of deposit, overnight and time deposits)
  { id: "gold_offshore_dashbanks",    source: "sec:offshore",           target: "sec:dash_banks_pair", color: "gold", seriesIds: [], label: "" },
  { id: "gold_onshoreinv_dashbanks",  source: "sec:onshore_inv",        target: "sec:dash_banks_pair", color: "gold", seriesIds: [], label: "" },
  { id: "gold_offmmf_fbank",          source: "offshore_mmf",           target: "foreign_banks",       color: "gold", seriesIds: [], label: "" },
  { id: "gold_finins_fbank",          source: "foreign_insurers",       target: "foreign_banks",       color: "gold", seriesIds: [], label: "" },
  { id: "gold_corpoff_fbank",         source: "corporates_offshore",    target: "foreign_banks",       color: "gold", seriesIds: [], label: "" },
  { id: "gold_fcboff_fbank",          source: "fcb_swf_supra_offshore", target: "foreign_banks",       color: "gold", seriesIds: [], label: "" },

  // ── Pink | Eurodollar lending ───────────────────────────────────────────
  { id: "pink_primemmf_fbank",    source: "prime_mmf",  target: "foreign_banks",              color: "pink", seriesIds: [],            label: "" },
  { id: "pink_fcboff_fbank",      source: "fcb_swf_supra_offshore", target: "foreign_banks",    color: "pink", seriesIds: [],            label: "" },
  { id: "pink_finins_fbank",      source: "foreign_insurers",       target: "foreign_banks",    color: "pink", seriesIds: [],            label: "" },
  { id: "pink_corpoff_fbank",     source: "corporates_offshore",    target: "foreign_banks",    color: "pink", seriesIds: [],            label: "" },
  { id: "pink_offmmf_fbank",      source: "offshore_mmf",           target: "foreign_banks",    color: "pink", seriesIds: [],            label: "" },
  { id: "pink_dashinv_fbank",     source: "sec:dash_investor_group", target: "foreign_banks",   color: "pink", seriesIds: [],            label: "" },

  // ── Magenta | Securities purchases from Treasury and government-sponsored enterprises
  // Source = section/dashed-box ID (connects from region edge), Target = node or region
  { id: "magenta_banksdealers_govent",   source: "sec:banks_dealers",    target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_onshoreinv_govent",     source: "sec:onshore_inv",      target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_offshore_govent",       source: "sec:offshore",         target: "sec:gov_entities", color: "magenta", seriesIds: [], label: "" },
  { id: "magenta_dashedgse_ustreas",     source: "sec:dash_gse_pair",    target: "us_treasury",      color: "magenta", seriesIds: [], label: "" },


  // ── Light green | Fed funds lending ────────────────────────────────────
  { id: "light_green_dashgse_dashbanks", source: "sec:dash_gse_pair", target: "sec:dash_banks_pair", color: "light_green", seriesIds: [], label: "" },
  { id: "light_green_usbanks_self", source: "us_banks", target: "us_banks", color: "light_green", seriesIds: [], label: "" },
  { id: "light_green_usfbo_self", source: "us_fbo", target: "us_fbo", color: "light_green", seriesIds: [], label: "" },
  { id: "light_green_usbanks_usfbo", source: "us_banks", target: "us_fbo", color: "light_green", seriesIds: [], label: "", connectionType: EDGE_CONNECTION_TYPES.BIDIRECTIONAL },

].map(edge => ({
  connectionType: EDGE_CONNECTION_TYPES.CONNECTED,
  ...edge,
}));

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

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic node-size computation (run once at module load)
// Rules:
// 1. Default size is preserved if text fits.
// 2. If text exceeds default, expand width up to a computed maxWidth.
// 3. Max width respects the tightest containing section boundaries and
//    same-row neighbors (so shapes don't overlap horizontally).
// 4. Once max width is reached, wrap text and expand height instead.
// 5. For circles/hexagons, rx expands up to max; then ry expands for height.
// ═══════════════════════════════════════════════════════════════════════════

const MARGIN = 10;
const BS_MARGIN = 12;

function estimateTextWidth(text, fontSize) {
  const avgCharWidth = fontSize * 0.58;
  return text.length * avgCharWidth;
}

function autoWrapForSize(label, fontSize, maxWidth) {
  const cw = NODE_TEXT.CHAR_WIDTH_MAP[fontSize] || fontSize * 0.58;
  const maxChars = Math.floor(maxWidth / cw);
  if (label.length <= maxChars) return [label];
  const words = label.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (trial.length <= maxChars) {
      current = trial;
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}

/** Find the smallest section that spatially contains this node. */
function findContainingSection(node, sections) {
  const containing = sections.filter(s =>
    node.x >= s.x && node.x <= s.x + s.w &&
    node.y >= s.y && node.y <= s.y + s.h
  );
  if (!containing.length) return null;
  return containing.sort((a, b) => (a.w * a.h) - (b.w * b.h))[0];
}

/** Compute max allowable width for a node based on section bounds and same-row neighbors. */
function computeNodeMaxWidth(node, allNodes, sections) {
  const section = findContainingSection(node, sections);
  if (!section) return Infinity;

  const sectionPadding = 6;
  let maxHalfWidth = Math.min(
    node.x - (section.x + sectionPadding),
    (section.x + section.w - sectionPadding) - node.x
  );

  // Constrain by same-row neighbors (within 35 px vertically)
  const yTolerance = 35;
  const sameRow = allNodes.filter(n =>
    n.id !== node.id && Math.abs(n.y - node.y) <= yTolerance
  );
  for (const neighbor of sameRow) {
    const distance = Math.abs(neighbor.x - node.x);
    maxHalfWidth = Math.min(maxHalfWidth, distance / 2);
  }

  return Math.max(maxHalfWidth * 2, 60);
}

/** Compute minimum ry so every text line fits inside an ellipse/hexagon at its y position. */
function computeRequiredRy(rx, lines, lineHeight, margin, fontSize) {
  const halfTextHeight = (lines.length * lineHeight) / 2;
  let requiredRy = 0;
  lines.forEach((line, i) => {
    const yCenter = -halfTextHeight + i * lineHeight + lineHeight / 2;
    const textW = estimateTextWidth(line, fontSize);
    const neededW = textW + margin;
    if (neededW >= 2 * rx) {
      requiredRy = Math.max(requiredRy, Math.abs(yCenter) + lineHeight);
    } else {
      const ratio = neededW / (2 * rx);
      const minRy = Math.abs(yCenter) / Math.sqrt(1 - ratio * ratio);
      requiredRy = Math.max(requiredRy, minRy);
    }
  });
  return Math.ceil(requiredRy);
}

NODES.forEach(node => {
  const sz = SHAPE_SIZES[node.shape];
  const isBs = node.shape === "bs_parent" || node.shape === "bs_child";
  const isBsChild = node.shape === "bs_child";
  const fontSize = isBs ? (isBsChild ? 14 : 15) : 16;

  const maxWidth = computeNodeMaxWidth(node, NODES, SECTIONS);

  let lines = node.label.split("\n");
  let maxLineWidth = Math.max(...lines.map(l => estimateTextWidth(l, fontSize)));

  const newSize = { ...sz };
  let changed = false;

  if (node.shape === "rectangle" || isBs) {
    const margin = isBs ? BS_MARGIN : MARGIN;
    const defaultThreshold = sz.width - margin * 2;

    if (maxLineWidth > defaultThreshold) {
      const requiredWidth = Math.round(maxLineWidth + margin * 2);
      const newWidth = Math.max(sz.width, Math.min(requiredWidth, maxWidth));
      if (newWidth > sz.width) {
        newSize.width = newWidth;
        changed = true;
      }
      const availableWidth = newWidth - margin * 2;
      if (maxLineWidth > availableWidth) {
        lines = autoWrapForSize(node.label, fontSize, availableWidth);
      }
    }

    const lineHeight = isBsChild ? 10 : (isBs ? 11 : 13);
    const targetHeight = Math.max(sz.height, 14 + (lines.length - 1) * lineHeight);
    if (targetHeight > sz.height) {
      newSize.height = targetHeight;
      changed = true;
    }

    if (changed) {
      node._size = newSize;
      node._lines = lines;
    }
  } else if (node.shape === "hexagon" || node.shape === "circle") {
    const margin = MARGIN;
    const defaultThreshold = sz.rx * 2 - margin * 2;

    if (maxLineWidth > defaultThreshold) {
      const requiredRx = Math.round((maxLineWidth + margin * 2) / 2);
      const maxRx = Math.floor(maxWidth / 2);
      const newRx = Math.max(sz.rx, Math.min(requiredRx, maxRx));
      if (newRx > sz.rx) {
        newSize.rx = newRx;
        changed = true;
      }
      const availableWidth = newRx * 2 - margin * 2;
      if (maxLineWidth > availableWidth) {
        lines = autoWrapForSize(node.label, fontSize, availableWidth);
      }
    }

    const lineHeight = 13;
    const targetRy = Math.max(
      sz.ry,
      computeRequiredRy(newSize.rx, lines, lineHeight, margin, fontSize)
    );
    if (targetRy > sz.ry) {
      newSize.ry = targetRy;
      changed = true;
    }

    if (changed) {
      node._size = newSize;
      node._lines = lines;
    }
  }
});
