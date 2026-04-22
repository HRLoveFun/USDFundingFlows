/**
 * config.js — Central UI, layout & interaction configuration.
 * All visual/layout/timing constants live here so they can be adjusted in one place.
 */

// ── Canvas / Viewport ─────────────────────────────────────────────────────
export const CANVAS = {
  WIDTH: 2150,
  HEIGHT: 1280,
};

// ── Grid resolution for port generation ───────────────────────────────────
export const GRID = 10;

// ── Shape types ───────────────────────────────────────────────────────────
export const SHAPE_TYPES = {
  HEXAGON:   "hexagon",
  CIRCLE:    "circle",
  RECTANGLE: "rectangle",
  BS_PARENT: "bs_parent",
  BS_CHILD:  "bs_child",
};

// ── Shape fill colors ─────────────────────────────────────────────────────
export const SHAPE_COLORS = {
  hexagon:   "#5C6BC0",  // indigo (intermediary institutions)
  circle:    "#26A69A",  // teal (investor institutions)
  rectangle: "#607D8B",  // blue-gray (government)
};

// ── Shape sizing ──────────────────────────────────────────────────────────
export const SHAPE_SIZES = {
  hexagon:   { rx: 110, ry: 38 },
  circle:    { rx: 102, ry: 36 },
  rectangle: { width: 155, height: 58 },
  bs_parent: { width: 190, height: 50 },
  bs_child:  { width: 175, height: 40 },
};

// ── Node category colors (for sidebar legend) ─────────────────────────────
export const CATEGORY_COLORS = {
  hexagon:   "#5C6BC0",
  circle:    "#26A69A",
  rectangle: "#607D8B",
  bs_parent: "#E3F2FD",
  bs_child:  "#FFF8E1",
};

// ── Arrow / edge color definitions ────────────────────────────────────────
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

// ── Edge connection types ─────────────────────────────────────────────────
export const EDGE_CONNECTION_TYPES = {
  SELF: "self",
  CONNECTED: "connected",
  BIDIRECTIONAL: "bidirectional",
};

// ── Edge visual parameters ───────────────────────────────────────────────
export const EDGE_STYLE = {
  STROKE_WIDTH: 1.0,
  EMPTY_VALUE_STROKE_WIDTH: 3.6,
  HOVER_WIDTH: 1.4,
};

// ── Edge routing parameters ───────────────────────────────────────────────
export const ROUTING = {
  FED_PANEL_RIGHT: 520,
  CORRIDOR_X: 530,
  MIN_GAP: 10,              // minimum spacing between endpoints / edges / corridors
  OFFSET_PX: 10,            // parallel-edge lane spacing
  PAD: 4,                   // padding around shapes for collision detection
  DASH_OVERLAP_MIN: 15,     // px threshold for "large overlap" with dashed section borders
};

// ── Node text / auto-wrap estimates ───────────────────────────────────────
export const NODE_TEXT = {
  CHAR_WIDTH_MAP: { 15: 8.7, 14: 8.1 },
};

// ── Timing / interaction ──────────────────────────────────────────────────
export const TIMING = {
  FETCH_TIMEOUT: 15000,           // data fetch timeout (ms)
  HIDE_GRACE_MS: 200,             // tooltip hide grace period (ms)
  SLIDER_DEBOUNCE_MS: 50,         // time-selector slider debounce (ms)
  LOADING_OVERLAY_DELAY_MS: 100,  // loading overlay removal delay (ms)
};

// ── Sidebar legend labels ─────────────────────────────────────────────────
export const SHAPE_LABELS = {
  hexagon:   "Intermediary institutions (Hexagon)",
  circle:    "Investor Institutions (Circle)",
  rectangle: "Government (Rectangle)",
};
