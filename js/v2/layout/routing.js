/**
 * v2/layout/routing.js — edge path routing.
 *
 * Provides three primitives:
 *   - routeManhattan(s, t, opts) — three-segment orthogonal path used
 *     for edges within the same panel.
 *   - routeBezier(s, t, opts)    — single cubic Bézier used for cross-
 *     panel long edges.
 *   - pickRouter(s, t)           — chooses between the two based on
 *     whether the endpoints share a panel.
 *
 * Each node is assumed to have { x, y, width, height, panel }. Source
 * exit anchors at right edge, target entry at left edge.
 */

/** Default vertical/horizontal gutters where Manhattan elbows can
 *  safely turn without hitting other nodes. Tuned to match panels.js. */
export const GUTTERS = {
  fed_market: 552,
  banks_to_invest: 405,
  invest_to_gov: 935,
  onshore_to_offshore: 1525,
};

function rightAnchor(n) {
  return { x: n.x + n.width, y: n.y + n.height / 2 };
}
function leftAnchor(n) {
  return { x: n.x, y: n.y + n.height / 2 };
}

/**
 * Three-segment Manhattan route: source → horizontal → vertical → target.
 * @param {object} source node with x,y,width,height
 * @param {object} target node with x,y,width,height
 * @param {{gutter?: number, offset?: number}} [opts]
 * @returns {string} SVG path data
 */
export function routeManhattan(source, target, opts = {}) {
  const s = rightAnchor(source);
  const t = leftAnchor(target);
  const gutter = opts.gutter ?? (s.x + t.x) / 2;
  const offset = opts.offset ?? 0;
  const sy = s.y + offset;
  const ty = t.y + offset;
  return `M ${s.x} ${sy} L ${gutter} ${sy} L ${gutter} ${ty} L ${t.x} ${ty}`;
}

/**
 * Cubic Bézier route for cross-panel edges.
 * @param {object} source
 * @param {object} target
 * @param {{offset?: number}} [opts]
 * @returns {string}
 */
export function routeBezier(source, target, opts = {}) {
  const s = rightAnchor(source);
  const t = leftAnchor(target);
  const offset = opts.offset ?? 0;
  const sy = s.y + offset;
  const ty = t.y + offset;
  const cx = (s.x + t.x) / 2;
  return `M ${s.x} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${t.x} ${ty}`;
}

/**
 * Pick the appropriate router for a (source, target) pair.
 * Same-panel pairs use Manhattan; cross-panel pairs use Bézier.
 * @returns {(s: object, t: object, opts?: object) => string}
 */
export function pickRouter(source, target) {
  return source.panel === target.panel ? routeManhattan : routeBezier;
}

/**
 * Edge bundling: assigns a vertical pixel offset to edges that share
 * the same source node and target panel so that they fan out near
 * the source instead of overlapping.
 *
 * Mutates each edge to add `_bundleOffset` (number, px).
 * @param {Array<{source: string, target_panel?: string}>} edges
 */
export function applyBundleOffset(edges) {
  const groups = {};
  for (const e of edges) {
    const key = `${e.source}__${e.target_panel ?? ""}`;
    (groups[key] ??= []).push(e);
  }
  for (const arr of Object.values(groups)) {
    if (arr.length <= 1) {
      arr[0]._bundleOffset = 0;
      continue;
    }
    arr.forEach((e, i) => {
      e._bundleOffset = (i - (arr.length - 1) / 2) * 8;
    });
  }
  return edges;
}
