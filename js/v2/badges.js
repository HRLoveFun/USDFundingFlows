/**
 * v2/badges.js — proxy-value badges centered above v1-rendered nodes.
 *
 * Module C deliverable: each node gets a small SVG badge anchored
 * **horizontally centered, just above** its top edge, showing the
 * latest value of its primary proxy. Anchor relocation per S3.1 D-005
 * Branch A (top-center), with geometry capped at:
 *   - badge rect height        = 14 px (BADGE_H)
 *   - vertical gap above node  = 3  px (BADGE_PAD)
 *   - total vertical footprint = 17 px (fits in tightest 20-px BS row)
 *
 * S3.2: hovering a badge shows a minimal HTML tooltip via
 * `showBadgeProxy()` from `tooltip.js` — proxy_id, source · frequency,
 * observation YYYY-MM. AC#4 satisfied via this hover surface.
 *
 * S3.3: stale + cross-source-violation visual states (plan row 3.3).
 *   - Stale gray-out (kind "stale") when latest observation older than
 *     STALE_THRESHOLDS_DAYS[frequency] (D-006). For FRED-cached nodes
 *     uses the live obsDate; for other sources falls back to
 *     `proxy.last_updated`.
 *   - Amber violation (kind "violation") when the node id appears in
 *     `crossDiff.summary.violation_node_ids` (5% rule, spec AC#6).
 *   - Precedence: violation > stale > value/info/muted.
 *
 * S3.4: badges follow the v2 sidebar time selector (plan row 3.4).
 *   - `renderProxyBadges(layer, nodes, dataLoader, crossDiff, currentDate)`
 *     accepts an optional 5th `currentDate` arg (`YYYY-MM-DD`).
 *   - For FRED proxies, `seriesValueAtOrBefore(...)` walks `dataLoader.dates`
 *     backwards from `currentDate` (inclusive) — spec AC#5
 *     "频率不匹配时取最近一次观测".
 *   - Stale check uses `currentDate` as its reference clock (so dragging
 *     to 2024-01-01 reflects stale-as-of-then, not stale-as-of-today).
 *   - When `currentDate` is omitted/null → falls back to S3.3 behavior
 *     (latest cached + Date.now() reference).
 *
 * Nodes lacking a proxy (or with `primary: null` per AC#3) render
 * "—" in muted style; the hover tooltip surfaces the registry `reason`.
 *
 * The overlay is purely additive — the v1 renderer is untouched, so
 * §0.1.2 (v2 visual baseline = v1) remains intact for nodes without a
 * registered proxy. Only nodes in NODES (the v2 list) get a badge,
 * and v1 doesn't load this module.
 */

import { SHAPE_SIZES } from "../config.js";
import { showBadgeProxy, hideTooltip } from "./tooltip.js";
import { formatValue as fmtValue } from "./value_format.js";

const NS = "http://www.w3.org/2000/svg";

// Geometry constants per S3.1 D-005 (Branch A, fits in current viewBox).
const BADGE_H   = 14;   // rect height
const BADGE_PAD = 3;    // gap between rect bottom and node top edge

// D-006 stale thresholds — calendar days since latest observation past
// which a badge is rendered grayed-out with a `stale` tooltip line.
// Mirrors `data/json/cross_source_diff.json` `stale_thresholds_days`
// so the offline scanner and the live UI agree exactly.
const STALE_THRESHOLDS_DAYS = {
  D: 7,
  W: 21,
  M: 60,
  Q: 180,
  irregular: Number.POSITIVE_INFINITY,
};

const DAY_MS = 86400000;

function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function nodeHalfExtent(node) {
  const dim = node._size ?? SHAPE_SIZES[node.shape];
  if (!dim) return { hw: 60, hh: 20 };
  if (dim.rx != null) return { hw: dim.rx, hh: dim.ry };
  return { hw: dim.width / 2, hh: dim.height / 2 };
}

function latestSeriesValue(dataLoader, seriesId) {
  if (!dataLoader || !seriesId) return null;
  const dates = dataLoader.dates ?? [];
  const ts    = dataLoader.timeSeries ?? {};
  for (let i = dates.length - 1; i >= 0; i--) {
    const row = ts[dates[i]];
    if (row && row[seriesId] != null) {
      return { date: dates[i], value: row[seriesId] };
    }
  }
  return null;
}

/**
 * S3.4: walk `dataLoader.dates` backwards starting from the index of
 * `currentDate` (or, if `currentDate` is missing from the array, from
 * the largest available date ≤ currentDate). Returns the first
 * non-null hit — satisfying spec AC#5 “频率不匹配时取最近一次观测”.
 */
function seriesValueAtOrBefore(dataLoader, seriesId, currentDate) {
  if (!dataLoader || !seriesId) return null;
  const dates = dataLoader.dates ?? [];
  const ts    = dataLoader.timeSeries ?? {};
  if (dates.length === 0) return null;
  if (!currentDate) return latestSeriesValue(dataLoader, seriesId);
  // dates[] is sorted ascending; find largest index whose date <= currentDate.
  let startIdx = -1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= currentDate) { startIdx = i; break; }
  }
  if (startIdx < 0) return null;     // currentDate predates the dataset entirely
  for (let i = startIdx; i >= 0; i--) {
    const row = ts[dates[i]];
    if (row && row[seriesId] != null) {
      return { date: dates[i], value: row[seriesId] };
    }
  }
  return null;
}

/**
 * @param {string|null} obsDate       YYYY-MM-DD or null (no data)
 * @param {string}      frequency     D|W|M|Q|irregular
 * @param {string|null} [referenceDate] YYYY-MM-DD; if null, uses Date.now()
 * @returns {{ageDays:number, threshold:number, since:string}|null}
 */
function computeStaleness(obsDate, frequency, referenceDate = null) {
  if (!obsDate) return null;
  const t = STALE_THRESHOLDS_DAYS[frequency];
  if (t == null || !Number.isFinite(t)) return null;     // unknown / irregular
  const refMs = referenceDate ? new Date(referenceDate).getTime() : Date.now();
  const ms = refMs - new Date(obsDate).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const ageDays = Math.floor(ms / DAY_MS);
  if (ageDays <= t) return null;
  return { ageDays, threshold: t, since: obsDate.slice(0, 7) };
}

function isViolation(nodeId, crossDiff) {
  const ids = crossDiff?.summary?.violation_node_ids;
  return Array.isArray(ids) && ids.includes(nodeId);
}

function badgeContent(node, dataLoader, crossDiff, currentDate) {
  const proxy = node.proxy;
  if (!proxy) return null;

  // Base content (text + observation date) determined first; styling kind
  // is then upgraded by stale / violation precedence.
  let text;
  let baseKind;
  let obsDate = null;

  if (proxy.primary == null) {
    // D-002: primary === null carries `reason`; AC#3 says no fake value.
    text = "—";
    baseKind = "muted";
  } else {
    const primary = proxy.primary;
    if (primary.source === "FRED" && dataLoader) {
      const hit = currentDate
        ? seriesValueAtOrBefore(dataLoader, primary.proxy_id, currentDate)
        : latestSeriesValue(dataLoader, primary.proxy_id);
      if (hit) {
        const meta  = dataLoader?.metadata?.[primary.proxy_id] ?? {};
        const units = meta.units ?? primary.units ?? "";
        text = fmtValue(hit.value, units, dataLoader);
        baseKind = "value";
        obsDate = hit.date;
      } else {
        text = primary.source;
        baseKind = "info";
        // FRED w/o cache hit — last_updated reflects registry freshness.
        obsDate = proxy.last_updated ?? null;
      }
    } else {
      text = primary.source;
      baseKind = "info";
      obsDate = proxy.last_updated ?? null;
    }
  }

  // Stale + violation upgrades (precedence: violation > stale > base).
  const frequency = proxy.primary?.frequency ?? null;
  const stale = baseKind === "muted" ? null : computeStaleness(obsDate, frequency, currentDate);
  const violation = isViolation(node.id, crossDiff);

  let kind = baseKind;
  if (stale)     kind = "stale";
  if (violation) kind = "violation";

  return { text, kind, date: obsDate, stale, violation };
}

/**
 * Render proxy-value badges into `layer` for each node in `nodes`.
 *
 * Anchor (S3.1 D-005 Branch A):
 *   badge group transform = translate(node.x, node.y − hh − BADGE_PAD − BADGE_H/2)
 *   rect:  x = −w/2, y = −BADGE_H/2, height = BADGE_H
 *   text:  x = 0, y = 0, text-anchor = middle, dominant-baseline = central
 *
 * @param {SVGGElement|d3.Selection} layer
 * @param {Array<object>}            nodes        v2 NODES (decorated with proxy)
 * @param {object}                   dataLoader   v1 DataLoader instance
 * @param {object|null}              [crossDiff]  cross_source_diff.json contents
 * @param {string|null}              [currentDate] YYYY-MM-DD; null → latest cached
 */
export function renderProxyBadges(layer, nodes, dataLoader, crossDiff = null, currentDate = null) {
  const root = layer?.node ? layer.node() : layer;
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);

  for (const n of nodes) {
    const content = badgeContent(n, dataLoader, crossDiff, currentDate);
    if (!content) continue;

    const { hw, hh } = nodeHalfExtent(n);
    // Top-center anchor: rect center sits BADGE_PAD above node top edge,
    // BADGE_H/2 further up (so the rect's bottom is exactly BADGE_PAD above).
    const cx = n.x;
    const cy = n.y - hh - BADGE_PAD - BADGE_H / 2;

    const g = svg("g", {
      class: `proxy-badge proxy-badge-${content.kind}`,
      "data-node-id": n.id,
      transform: `translate(${cx}, ${cy})`,
    });

    const padX = 6;
    const fontSize = 11;
    const charW = fontSize * 0.55;
    const w = Math.max(20, content.text.length * charW + padX * 2);

    g.appendChild(svg("rect", {
      x: -w / 2, y: -BADGE_H / 2, width: w, height: BADGE_H, rx: 7, ry: 7,
      class: "proxy-badge-bg",
    }));
    const text = svg("text", {
      x: 0, y: 0,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      class: "proxy-badge-text",
    });
    text.textContent = content.text;
    g.appendChild(text);

    // Hover wiring → minimal proxy tooltip (AC#4 + AC#5/AC#6).
    const obsDate   = content.date ?? null;
    const stale     = content.stale ?? null;
    const violation = content.violation ?? false;
    const handler   = (ev) => showBadgeProxy(n, ev, dataLoader, obsDate, { stale, violation, crossDiff });
    g.addEventListener("mouseenter", handler);
    g.addEventListener("mousemove",  handler);
    g.addEventListener("mouseleave", () => hideTooltip());

    root.appendChild(g);
  }
}
