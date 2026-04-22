/**
 * edges.js — D3 rendering of directed funding flow edges.
 * Self-loop arcs plus orthogonal connected-edge routing with port-based points.
 * Each node shape exposes multiple ports; the router assigns a unique port per edge,
 * guaranteeing that each connection point is used by at most one edge.
 */
import { EDGES, NODES, EDGE_COLORS, EDGE_CONNECTION_TYPES, SHAPE_SIZES, SECTIONS } from "./constants.js";
import { ROUTING, EDGE_STYLE } from "./config.js";
import { isSelecting } from "./tooltip.js";

const { FED_PANEL_RIGHT, CORRIDOR_X, MIN_GAP, DASH_OVERLAP_MIN, OFFSET_PX: ROUTING_OFFSET_PX, PAD } = ROUTING;
const { STROKE_WIDTH: EDGE_STROKE_WIDTH, EMPTY_VALUE_STROKE_WIDTH, HOVER_WIDTH } = EDGE_STYLE;

// Global allocation state (reset each render)
const allocatedNodePorts = new Map();       // endpointId -> [{x,y}]
const usedCorridors = new Map();            // 'x'|'y' -> number[]
const routedSegments = [];                  // previously routed axis-aligned segments

const DASHED_SECTIONS = SECTIONS.filter(s => s.style === 'dashed' || s.style === 'dashed_gray');
const ROUTE_SECTION_STYLES = new Set(["subheader", "group", "dashed", "dashed_gray"]);
const SECTION_CORNER_INSET = 24;
const ROUTE_SECTION_INSET = 10;
const TURN_PENALTY = 90;
const EXTRA_TURN_PENALTY = 180;
const SIGNIFICANT_OVERLAP_MIN = 28;
const OVERLAP_PENALTY_PER_PX = 12;
const FOREIGN_REGION_PENALTY = 900;

/**
 * Resolve an endpoint (node-id or "sec:sectionId") to its {x, y} center
 * and optionally return the section rect if it's a section reference.
 */
function resolveEndpoint(id) {
  if (id.startsWith("sec:")) {
    const sec = sectionMap[id.slice(4)];
    if (!sec) return { x: 0, y: 0, isSection: true, rect: null };
    return {
      x: sec.x + sec.w / 2,
      y: sec.y + sec.h / 2,
      isSection: true,
      rect: sec,
    };
  }
  const n = nodeMap[id];
  return { x: n?.x ?? 0, y: n?.y ?? 0, isSection: false, rect: null };
}

const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

// ── Section map for region-edge connections ─────────────────────────────
const sectionMap = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

function roundCoord(value) {
  return Math.round(value * 10) / 10;
}

function dedupPoints(points) {
  const out = [];
  for (const p of points) {
    const point = { x: roundCoord(p.x), y: roundCoord(p.y) };
    if (!out.some(q => Math.abs(q.x - point.x) < 1 && Math.abs(q.y - point.y) < 1)) {
      out.push(point);
    }
  }
  return out;
}

function uniqueSorted(values) {
  return [...new Set(values.map(roundCoord))].sort((a, b) => a - b);
}

function shapeBounds(node) {
  const sz = SHAPE_SIZES[node.shape];
  if (sz.width) {
    return {
      left: node.x - sz.width / 2,
      right: node.x + sz.width / 2,
      top: node.y - sz.height / 2,
      bottom: node.y + sz.height / 2,
    };
  }
  return {
    left: node.x - sz.rx,
    right: node.x + sz.rx,
    top: node.y - sz.ry,
    bottom: node.y + sz.ry,
  };
}

function buildLineNetwork() {
  const xLines = new Set([CORRIDOR_X]);
  const yLines = new Set();

  NODES.forEach(node => {
    const bounds = shapeBounds(node);
    xLines.add(node.x);
    xLines.add(bounds.left);
    xLines.add(bounds.right);
    yLines.add(node.y);
    yLines.add(bounds.top);
    yLines.add(bounds.bottom);
  });

  SECTIONS.forEach(section => {
    xLines.add(section.x);
    xLines.add(section.x + section.w / 2);
    xLines.add(section.x + section.w);
    yLines.add(section.y);
    yLines.add(section.y + section.h / 2);
    yLines.add(section.y + section.h);
  });

  return {
    x: uniqueSorted([...xLines]),
    y: uniqueSorted([...yLines]),
  };
}

const LINE_NETWORK = buildLineNetwork();
const nodePortCache = new Map();
const sectionEndpointCache = new Map();

function rectBoundaryPoints(left, top, right, bottom) {
  const points = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: (left + right) / 2, y: top },
    { x: right, y: (top + bottom) / 2 },
    { x: (left + right) / 2, y: bottom },
    { x: left, y: (top + bottom) / 2 },
  ];

  for (const xLine of LINE_NETWORK.x) {
    if (xLine >= left - 1 && xLine <= right + 1) {
      points.push({ x: xLine, y: top });
      points.push({ x: xLine, y: bottom });
    }
  }

  for (const yLine of LINE_NETWORK.y) {
    if (yLine >= top - 1 && yLine <= bottom + 1) {
      points.push({ x: left, y: yLine });
      points.push({ x: right, y: yLine });
    }
  }

  return dedupPoints(points);
}

function ellipseBoundaryPoints(cx, cy, rx, ry) {
  const points = [
    { x: cx + rx, y: cy },
    { x: cx - rx, y: cy },
    { x: cx, y: cy + ry },
    { x: cx, y: cy - ry },
  ];

  for (const yLine of LINE_NETWORK.y) {
    const ratio = (yLine - cy) / ry;
    if (Math.abs(ratio) > 1) continue;
    const dx = rx * Math.sqrt(1 - ratio * ratio);
    points.push({ x: cx + dx, y: yLine });
    points.push({ x: cx - dx, y: yLine });
  }

  for (const xLine of LINE_NETWORK.x) {
    const ratio = (xLine - cx) / rx;
    if (Math.abs(ratio) > 1) continue;
    const dy = ry * Math.sqrt(1 - ratio * ratio);
    points.push({ x: xLine, y: cy + dy });
    points.push({ x: xLine, y: cy - dy });
  }

  return dedupPoints(points);
}

function hexBoundaryPoints(cx, cy, rx, ry) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    verts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }

  const points = [...verts];

  for (let i = 0; i < 6; i++) {
    const A = verts[i];
    const B = verts[(i + 1) % 6];
    const dx = B.x - A.x;
    const dy = B.y - A.y;

    if (Math.abs(dy) > 0.01) {
      const yMin = Math.min(A.y, B.y);
      const yMax = Math.max(A.y, B.y);
      for (const yLine of LINE_NETWORK.y) {
        if (yLine < yMin - 1 || yLine > yMax + 1) continue;
        const t = (yLine - A.y) / dy;
        if (t >= 0 && t <= 1) points.push({ x: A.x + t * dx, y: yLine });
      }
    }

    if (Math.abs(dx) > 0.01) {
      const xMin = Math.min(A.x, B.x);
      const xMax = Math.max(A.x, B.x);
      for (const xLine of LINE_NETWORK.x) {
        if (xLine < xMin - 1 || xLine > xMax + 1) continue;
        const t = (xLine - A.x) / dx;
        if (t >= 0 && t <= 1) points.push({ x: xLine, y: A.y + t * dy });
      }
    }
  }

  return dedupPoints(points);
}

function nodeEndpointCandidates(nodeId) {
  if (nodePortCache.has(nodeId)) return nodePortCache.get(nodeId);

  const node = nodeMap[nodeId];
  if (!node) return [];

  const sz = node._size || SHAPE_SIZES[node.shape];
  let points;
  if (node.shape === "hexagon") {
    points = hexBoundaryPoints(node.x, node.y, sz.rx, sz.ry);
  } else if (node.shape === "circle") {
    points = ellipseBoundaryPoints(node.x, node.y, sz.rx, sz.ry);
  } else {
    points = rectBoundaryPoints(
      node.x - sz.width / 2,
      node.y - sz.height / 2,
      node.x + sz.width / 2,
      node.y + sz.height / 2,
    );
  }

  nodePortCache.set(nodeId, points);
  return points;
}

function sectionEndpointCandidates(rect) {
  if (!rect) return [];
  const key = rect.id ?? `${rect.x},${rect.y},${rect.w},${rect.h}`;
  if (sectionEndpointCache.has(key)) return sectionEndpointCache.get(key);

  const points = rectBoundaryPoints(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  if (rect.endpoints && !Array.isArray(rect.endpoints)) {
    points.push(...Object.values(rect.endpoints));
  }

  const deduped = dedupPoints(points);
  const filtered = deduped.filter(point => !isNearSectionCorner(point, rect));
  const candidates = filtered.length > 0 ? filtered : deduped;
  sectionEndpointCache.set(key, candidates);
  return candidates;
}

function isNearSectionCorner(point, rect) {
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;

  const onTop = Math.abs(point.y - top) < 1;
  const onBottom = Math.abs(point.y - bottom) < 1;
  const onLeft = Math.abs(point.x - left) < 1;
  const onRight = Math.abs(point.x - right) < 1;

  if ((onTop || onBottom) && (point.x <= left + SECTION_CORNER_INSET || point.x >= right - SECTION_CORNER_INSET)) {
    return true;
  }

  if ((onLeft || onRight) && (point.y <= top + SECTION_CORNER_INSET || point.y >= bottom - SECTION_CORNER_INSET)) {
    return true;
  }

  return false;
}

function endpointCandidates(id, info) {
  return info.isSection && info.rect
    ? sectionEndpointCandidates(info.rect)
    : nodeEndpointCandidates(id);
}

function normalizeWaypoints(points) {
  const out = [];
  for (const point of points) {
    if (!out.length) {
      out.push(point);
      continue;
    }
    const prev = out[out.length - 1];
    if (Math.abs(prev.x - point.x) < 0.1 && Math.abs(prev.y - point.y) < 0.1) continue;
    out.push(point);
  }
  return out;
}

function pointsToPath(points) {
  const pts = normalizeWaypoints(points);
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
  return d;
}

function polylineSegments(points) {
  const pts = normalizeWaypoints(points);
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    const horizontal = Math.abs(start.y - end.y) < 0.1;
    const vertical = Math.abs(start.x - end.x) < 0.1;
    if (!horizontal && !vertical) continue;
    segments.push({
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      horizontal,
      vertical,
    });
  }
  return segments;
}

function segmentSharedLength(a, b) {
  if (a.horizontal && b.horizontal && Math.abs(a.y1 - b.y1) < 0.1) {
    return Math.max(0, Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) - Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)));
  }
  if (a.vertical && b.vertical && Math.abs(a.x1 - b.x1) < 0.1) {
    return Math.max(0, Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) - Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)));
  }
  return 0;
}

function routedOverlapPenalty(points) {
  let penalty = 0;
  for (const segment of polylineSegments(points)) {
    for (const existing of routedSegments) {
      const sharedLength = segmentSharedLength(segment, existing);
      if (sharedLength <= SIGNIFICANT_OVERLAP_MIN) continue;
      penalty += (sharedLength - SIGNIFICANT_OVERLAP_MIN) * OVERLAP_PENALTY_PER_PX;
    }
  }
  return penalty;
}

function rememberRoutedSegments(edgeId, points) {
  for (const segment of polylineSegments(points)) {
    routedSegments.push({ ...segment, edgeId });
  }
}

function polylineLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
  }
  return total;
}

function polylineTurnCount(points) {
  let turns = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const dx1 = Math.sign(cur.x - prev.x);
    const dy1 = Math.sign(cur.y - prev.y);
    const dx2 = Math.sign(next.x - cur.x);
    const dy2 = Math.sign(next.y - cur.y);
    if (dx1 !== dx2 || dy1 !== dy2) turns++;
  }
  return turns;
}

function buildRouteContext(options) {
  const {
    sourceInfo,
    targetInfo,
    sourceOwner = null,
    targetOwner = null,
    crossPanel = false,
  } = options;

  const allowedSectionIds = new Set();
  if (!crossPanel) {
    for (const info of [sourceInfo, targetInfo]) {
      if (!info) continue;
      if (info.isSection && info.rect) allowedSectionIds.add(info.rect.id);
      for (const section of routingSections) {
        if (pointInShape(info.x, info.y, section.shape)) allowedSectionIds.add(section.id);
      }
    }
  }

  return {
    crossPanel,
    allowedSectionIds,
    ownerOptions: { startOwner: sourceOwner, endOwner: targetOwner },
  };
}

function foreignRegionPenalty(points, routeContext = {}) {
  if (routeContext.crossPanel) return 0;

  const allowedSectionIds = routeContext.allowedSectionIds ?? new Set();
  const seen = new Set();
  let penalty = 0;

  for (const segment of polylineSegments(points)) {
    for (const section of routingSections) {
      if (allowedSectionIds.has(section.id)) continue;
      if (!segmentIntersectsShape(segment.x1, segment.y1, segment.x2, segment.y2, section.shape)) continue;
      const key = `${section.id}:${segment.x1},${segment.y1},${segment.x2},${segment.y2}`;
      if (seen.has(key)) continue;
      seen.add(key);
      penalty += FOREIGN_REGION_PENALTY;
    }
  }

  return penalty;
}

function routePenalty(points, routeContext = {}) {
  const normalized = normalizeWaypoints(points);
  const turns = polylineTurnCount(normalized);
  return turns * TURN_PENALTY
    + Math.max(0, turns - 1) * EXTRA_TURN_PENALTY
    + routedOverlapPenalty(normalized)
    + foreignRegionPenalty(normalized, routeContext);
}

function pointDirectionPenalty(point, ownerInfo, targetInfo, crossPanel) {
  const dx = targetInfo.x - ownerInfo.x;
  const dy = targetInfo.y - ownerInfo.y;
  const penalty = crossPanel ? 180 : 300;

  if (crossPanel || Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0 && point.x < ownerInfo.x - 1) return penalty;
    if (dx < 0 && point.x > ownerInfo.x + 1) return penalty;
    return 0;
  }

  if (dy >= 0 && point.y < ownerInfo.y - 1) return penalty;
  if (dy < 0 && point.y > ownerInfo.y + 1) return penalty;
  return 0;
}

function pathCandidateCost(points, excludeIds, blockedPenalty, routeContext = {}) {
  const normalized = normalizeWaypoints(points);
  return polylineLength(normalized)
    + routePenalty(normalized, routeContext)
    + (isPolylineBlocked(normalized, excludeIds, routeContext.ownerOptions ?? {}) ? blockedPenalty : 0);
}

function estimateEndpointPairCost(start, end, options) {
  const {
    excludeIds,
    crossPanel,
    sourceInfo,
    targetInfo,
    sourceOwner = null,
    targetOwner = null,
  } = options;
  const routeContext = buildRouteContext({ sourceInfo, targetInfo, crossPanel, sourceOwner, targetOwner });
  const ownerOptions = routeContext.ownerOptions;
  const aligned = Math.abs(start.x - end.x) < 2 || Math.abs(start.y - end.y) < 2;

  if (crossPanel) {
    return pathCandidateCost([
      start,
      { x: CORRIDOR_X, y: start.y },
      { x: CORRIDOR_X, y: end.y },
      end,
    ], excludeIds, 2400, routeContext);
  }

  let best = Infinity;
  if (aligned && !isPolylineBlocked([start, end], excludeIds, ownerOptions)) {
    best = Math.min(best, Math.abs(start.x - end.x) + Math.abs(start.y - end.y) - 120 + routePenalty([start, end], routeContext));
  }

  const lCandidates = [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ];
  for (const points of lCandidates) {
    if (!isPolylineBlocked(points, excludeIds, ownerOptions)) {
      best = Math.min(best, polylineLength(points) + routePenalty(points, routeContext));
    }
  }

  if (!Number.isFinite(best)) {
    const fallback = findPolylineRoute(start.x, start.y, end.x, end.y, excludeIds, 0, routeContext);
    best = pathCandidateCost(fallback.waypoints, excludeIds, 3200, routeContext) + 120;
  }

  return best;
}

function trimCandidatePool(candidates, targetInfo, limit = 32) {
  if (candidates.length <= limit) return candidates;
  return [...candidates]
    .sort((a, b) => {
      const da = Math.min(Math.abs(a.x - targetInfo.x), Math.abs(a.y - targetInfo.y));
      const db = Math.min(Math.abs(b.x - targetInfo.x), Math.abs(b.y - targetInfo.y));
      return da - db;
    })
    .slice(0, limit);
}

function allocationPenalty(point, allocated) {
  if (!allocated || allocated.length === 0) return 0;

  let minDistSq = Infinity;
  for (const used of allocated) {
    const distSq = (point.x - used.x) ** 2 + (point.y - used.y) ** 2;
    if (distSq < minDistSq) minDistSq = distSq;
  }

  if (minDistSq >= MIN_GAP * MIN_GAP) return 0;

  const minDist = Math.sqrt(minDistSq);
  return 120 + (MIN_GAP - minDist) * 2;
}

function selectBestEndpointPair(sourceCandidates, targetCandidates, options) {
  const {
    sourceInfo,
    targetInfo,
    excludeIds,
    crossPanel,
    sourceOwner = null,
    targetOwner = null,
    sourceAllocated = [],
    targetAllocated = [],
  } = options;
  const sourcePool = trimCandidatePool(sourceCandidates, targetInfo);
  const targetPool = trimCandidatePool(targetCandidates, sourceInfo);

  let best = null;
  for (const start of sourcePool) {
    for (const end of targetPool) {
      const cost = estimateEndpointPairCost(start, end, {
        excludeIds,
        crossPanel,
        sourceInfo,
        targetInfo,
        sourceOwner,
        targetOwner,
      })
        + allocationPenalty(start, sourceAllocated)
        + allocationPenalty(end, targetAllocated)
        + pointDirectionPenalty(start, sourceInfo, targetInfo, crossPanel)
        + pointDirectionPenalty(end, targetInfo, sourceInfo, crossPanel);
      if (!best || cost < best.cost) best = { start, end, cost };
    }
  }

  if (best) return best;
  return {
    start: sourcePool[0] ?? { x: sourceInfo.x, y: sourceInfo.y },
    end: targetPool[0] ?? { x: targetInfo.x, y: targetInfo.y },
    cost: 0,
  };
}

/**
 * Compare all section boundary candidates against the other endpoint candidate set
 * and return the lowest-cost endpoint pair.
 */
function sectionEdgePoint(rect, targetCandidates, options) {
  return selectBestEndpointPair(sectionEndpointCandidates(rect), targetCandidates, options);
}

function isFedAnchor(info) {
  return info.x < FED_PANEL_RIGHT;
}

// ══════════════════════════════════════════════════════════════════════════
// Phase 2: Collision geometry & line-of-sight testing
// ══════════════════════════════════════════════════════════════════════════

// PAD is imported from config.js via ROUTING.PAD

const OWNER_TOUCH_STEP = 6;

function buildHexVertices(cx, cy, rx, ry) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    verts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return verts;
}

function buildNodeShape(node, padding = 0) {
  const sz = node._size || SHAPE_SIZES[node.shape];
  if (node.shape === "hexagon") {
    return {
      id: node.id,
      type: "polygon",
      verts: buildHexVertices(node.x, node.y, sz.rx + padding, sz.ry + padding),
    };
  }
  if (node.shape === "circle") {
    return {
      id: node.id,
      type: "ellipse",
      cx: node.x,
      cy: node.y,
      rx: sz.rx + padding,
      ry: sz.ry + padding,
    };
  }

  return {
    id: node.id,
    type: "rect",
    xMin: node.x - sz.width / 2 - padding,
    yMin: node.y - sz.height / 2 - padding,
    xMax: node.x + sz.width / 2 + padding,
    yMax: node.y + sz.height / 2 + padding,
  };
}

function buildSectionShape(rect) {
  if (!rect) return null;
  return {
    id: rect.id,
    type: "rect",
    xMin: rect.x,
    yMin: rect.y,
    xMax: rect.x + rect.w,
    yMax: rect.y + rect.h,
  };
}

function buildInsetSectionShape(section) {
  const inset = Math.min(ROUTE_SECTION_INSET, section.w / 4, section.h / 4);
  return {
    id: section.id,
    type: "rect",
    xMin: section.x + inset,
    yMin: section.y + inset,
    xMax: section.x + section.w - inset,
    yMax: section.y + section.h - inset,
  };
}

const ownerShapes = new Map(NODES.map(node => [node.id, buildNodeShape(node)]));
const routingSections = SECTIONS
  .filter(section => ROUTE_SECTION_STYLES.has(section.style))
  .map(section => ({ id: section.id, style: section.style, shape: buildInsetSectionShape(section) }));

function ownerShapeForEndpoint(endpointId, endpointInfo) {
  if (endpointInfo.isSection && endpointInfo.rect) return buildSectionShape(endpointInfo.rect);
  return ownerShapes.get(endpointId) ?? null;
}

/** Pre-compute collision primitives for all nodes. */
const collisionShapes = NODES.map(node => buildNodeShape(node, PAD));

/** Segment (x1,y1)→(x2,y2) vs AABB test. */
function segIntersectsRect(x1, y1, x2, y2, r) {
  // Cohen-Sutherland-style: quick reject then parametric check
  let tMin = 0, tMax = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const edges = [
    { p: -dx, q: x1 - r.xMin },
    { p:  dx, q: r.xMax - x1 },
    { p: -dy, q: y1 - r.yMin },
    { p:  dy, q: r.yMax - y1 },
  ];
  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
    else       { if (t < tMin) return false; if (t < tMax) tMax = t; }
  }
  return tMin <= tMax;
}

/** Segment vs convex polygon (vertices in order). */
function segIntersectsPolygon(x1, y1, x2, y2, verts) {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const A = verts[i], B = verts[(i + 1) % n];
    if (segsIntersect(x1, y1, x2, y2, A.x, A.y, B.x, B.y)) return true;
  }
  // Also check if segment start is fully inside polygon
  if (pointInConvex(x1, y1, verts)) return true;
  return false;
}

function segsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (Math.abs(d1) < 1e-6 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (Math.abs(d2) < 1e-6 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  if (Math.abs(d3) < 1e-6 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (Math.abs(d4) < 1e-6 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  return false;
}
function cross(ox, oy, ax, ay, bx, by) { return (ax-ox)*(by-oy)-(ay-oy)*(bx-ox); }
function onSegment(px, py, qx, qy, rx, ry) {
  return rx >= Math.min(px,qx)-1e-6 && rx <= Math.max(px,qx)+1e-6 &&
         ry >= Math.min(py,qy)-1e-6 && ry <= Math.max(py,qy)+1e-6;
}
function pointInConvex(px, py, verts) {
  let pos = 0, neg = 0;
  for (let i = 0; i < verts.length; i++) {
    const A = verts[i], B = verts[(i+1)%verts.length];
    const d = (B.x-A.x)*(py-A.y) - (B.y-A.y)*(px-A.x);
    if (d > 0) pos++; else if (d < 0) neg++;
    if (pos && neg) return false;
  }
  return true;
}

function pointInShape(x, y, shape) {
  switch (shape.type) {
    case "rect":
      return x >= shape.xMin - 1e-6 && x <= shape.xMax + 1e-6
        && y >= shape.yMin - 1e-6 && y <= shape.yMax + 1e-6;
    case "polygon":
      return pointInConvex(x, y, shape.verts);
    case "ellipse": {
      const u = (x - shape.cx) / shape.rx;
      const v = (y - shape.cy) / shape.ry;
      return u * u + v * v <= 1 + 1e-6;
    }
    default:
      return false;
  }
}

function segmentIntersectsShape(x1, y1, x2, y2, shape) {
  switch (shape.type) {
    case "rect":
      return segIntersectsRect(x1, y1, x2, y2, shape);
    case "polygon":
      return segIntersectsPolygon(x1, y1, x2, y2, shape.verts);
    case "ellipse":
      return segIntersectsEllipse(x1, y1, x2, y2, shape);
    default:
      return false;
  }
}

function segmentViolatesOwner(x1, y1, x2, y2, ownerShape, options = {}) {
  if (!ownerShape) return false;

  const { allowStartTouch = false, allowEndTouch = false } = options;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;

  const step = Math.min(OWNER_TOUCH_STEP, length * 0.49);
  const ux = dx / length;
  const uy = dy / length;

  let sx = x1;
  let sy = y1;
  let ex = x2;
  let ey = y2;

  if (allowStartTouch) {
    sx += ux * step;
    sy += uy * step;
    if (pointInShape(sx, sy, ownerShape)) return true;
  }

  if (allowEndTouch) {
    ex -= ux * step;
    ey -= uy * step;
    if (pointInShape(ex, ey, ownerShape)) return true;
  }

  if (Math.hypot(ex - sx, ey - sy) < 1e-6) return false;
  return segmentIntersectsShape(sx, sy, ex, ey, ownerShape);
}

/** Segment vs ellipse. */
function segIntersectsEllipse(x1, y1, x2, y2, e) {
  // Transform to unit circle: u = (x-cx)/rx, v = (y-cy)/ry
  const u1 = (x1 - e.cx) / e.rx, v1 = (y1 - e.cy) / e.ry;
  const u2 = (x2 - e.cx) / e.rx, v2 = (y2 - e.cy) / e.ry;
  const du = u2 - u1, dv = v2 - v1;
  const A = du*du + dv*dv;
  const B = 2*(u1*du + v1*dv);
  const C = u1*u1 + v1*v1 - 1;
  const disc = B*B - 4*A*C;
  if (disc < 0) return false;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-B - sqrtD) / (2*A);
  const t2 = (-B + sqrtD) / (2*A);
  // Intersection if either root is in [0,1]
  if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) return true;
  // Or segment is entirely inside
  if (t1 < 0 && t2 > 1) return true;
  return false;
}

/**
 * Detect if a horizontal/vertical segment runs along a dashed section border
 * for a "large" distance. Crossing (non-collinear intersection) is allowed.
 */
function segmentOverlapWithDashed(x1, y1, x2, y2) {
  const TOL = 1.5;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  for (const sec of DASHED_SECTIONS) {
    const left = sec.x, top = sec.y, right = sec.x + sec.w, bottom = sec.y + sec.h;
    // Horizontal segment vs top/bottom border
    if (Math.abs(y1 - y2) < TOL) {
      const y = y1;
      for (const borderY of [top, bottom]) {
        if (Math.abs(y - borderY) < TOL) {
          const overlap = Math.min(maxX, right) - Math.max(minX, left);
          if (overlap > DASH_OVERLAP_MIN) return true;
        }
      }
    }
    // Vertical segment vs left/right border
    if (Math.abs(x1 - x2) < TOL) {
      const x = x1;
      for (const borderX of [left, right]) {
        if (Math.abs(x - borderX) < TOL) {
          const overlap = Math.min(maxY, bottom) - Math.max(minY, top);
          if (overlap > DASH_OVERLAP_MIN) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if a line segment is blocked by any node shape.
 * @param {Set<string>} excludeIds - node IDs to skip (source + target)
 */
function isSegmentBlocked(x1, y1, x2, y2, excludeIds) {
  for (const s of collisionShapes) {
    if (excludeIds.has(s.id)) continue;
    switch (s.type) {
      case "rect":    if (segIntersectsRect(x1, y1, x2, y2, s)) return true; break;
      case "polygon": if (segIntersectsPolygon(x1, y1, x2, y2, s.verts)) return true; break;
      case "ellipse": if (segIntersectsEllipse(x1, y1, x2, y2, s)) return true; break;
    }
  }
  if (segmentOverlapWithDashed(x1, y1, x2, y2)) return true;
  return false;
}

/** Check if a polyline (array of {x,y} waypoints) is blocked. */
function isPolylineBlocked(waypoints, excludeIds, ownerOptions = {}) {
  const { startOwner = null, endOwner = null } = ownerOptions;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const isFirst = i === 0;
    const isLast = i === waypoints.length - 2;

    if (isSegmentBlocked(start.x, start.y, end.x, end.y, excludeIds)) return true;
    if (segmentViolatesOwner(start.x, start.y, end.x, end.y, startOwner, { allowStartTouch: isFirst })) return true;
    if (segmentViolatesOwner(start.x, start.y, end.x, end.y, endOwner, { allowEndTouch: isLast })) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════
// Phase 3: Port allocation — distance-based with sorted scan & convergence
// ══════════════════════════════════════════════════════════════════════════

// Tracks which local-port index has been assigned for each (nodeId, direction).
const usedPorts = new Map(); // key: `${nodeId}_${dir}` → Set of port indices

/**
 * Allocate the best available port on *node* facing toward *target*.
 * Uses distance-sorted scan with early termination (convergence after 5 non-improving).
 * Guarantees port uniqueness per (nodeId, dir).
 */
function allocatePort(nodeId, targetX, targetY, dir) {
  const node = nodeMap[nodeId];
  if (!node) return { x: 0, y: 0 };

  const ports = nodeEndpointCandidates(nodeId);
  if (!ports || ports.length === 0) return { x: node.x, y: node.y };

  const key = `${nodeId}_${dir}`;
  if (!usedPorts.has(key)) usedPorts.set(key, new Set());
  const taken = usedPorts.get(key);

  // Build distance-sorted index list (only untaken ports)
  const indices = [];
  for (let i = 0; i < ports.length; i++) {
    if (taken.has(i)) continue;
    const p = ports[i];
    const dx = p.x - targetX;
    const dy = p.y - targetY;
    indices.push({ i, dist: Math.min(Math.abs(dx), Math.abs(dy)) });
  }
  indices.sort((a, b) => a.dist - b.dist);

  // Pick the closest available port (convergence is already guaranteed by sorted order)
  let bestIdx = indices.length > 0 ? indices[0].i : 0;

  // Fallback: if all ports taken, scan all for closest
  if (indices.length === 0) {
    let bestDist = Infinity;
    for (let i = 0; i < ports.length; i++) {
      const p = ports[i];
      const dx = p.x - targetX;
      const dy = p.y - targetY;
      const d = Math.min(Math.abs(dx), Math.abs(dy));
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
  } else {
    taken.add(bestIdx);
  }

  const p = ports[bestIdx];
  return { x: p.x, y: p.y };
}

function edgeConnectionType(edge) {
  if (edge.connectionType === EDGE_CONNECTION_TYPES.SELF || edge.source === edge.target) {
    return EDGE_CONNECTION_TYPES.SELF;
  }
  return EDGE_CONNECTION_TYPES.CONNECTED;
}

function collisionShapeBounds(shape) {
  switch (shape.type) {
    case "rect":
      return { xMin: shape.xMin, xMax: shape.xMax, yMin: shape.yMin, yMax: shape.yMax };
    case "ellipse":
      return {
        xMin: shape.cx - shape.rx,
        xMax: shape.cx + shape.rx,
        yMin: shape.cy - shape.ry,
        yMax: shape.cy + shape.ry,
      };
    case "polygon": {
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      for (const v of shape.verts) {
        if (v.x < xMin) xMin = v.x;
        if (v.x > xMax) xMax = v.x;
        if (v.y < yMin) yMin = v.y;
        if (v.y > yMax) yMax = v.y;
      }
      return { xMin, xMax, yMin, yMax };
    }
    default:
      return null;
  }
}

function smallestContainingSection(node) {
  return SECTIONS
    .filter(section => (
      node.x >= section.x
      && node.x <= section.x + section.w
      && node.y >= section.y
      && node.y <= section.y + section.h
    ))
    .sort((a, b) => (a.w * a.h) - (b.w * b.h))[0] ?? null;
}

function selfLoopSideVectors(side) {
  switch (side) {
    case "top":
      return { normal: { x: 0, y: -1 }, tangent: { x: 1, y: 0 } };
    case "right":
      return { normal: { x: 1, y: 0 }, tangent: { x: 0, y: 1 } };
    case "bottom":
      return { normal: { x: 0, y: 1 }, tangent: { x: 1, y: 0 } };
    case "left":
      return { normal: { x: -1, y: 0 }, tangent: { x: 0, y: 1 } };
    default:
      return { normal: { x: 1, y: 0 }, tangent: { x: 0, y: 1 } };
  }
}

function selfLoopBoundaryClearance(node, side, container) {
  if (!container) return 220;

  switch (side) {
    case "top":
      return node.y - container.y;
    case "right":
      return container.x + container.w - node.x;
    case "bottom":
      return container.y + container.h - node.y;
    case "left":
      return node.x - container.x;
    default:
      return 0;
  }
}

function selfLoopNeighborBias(node, side, extentX, extentY) {
  let bias = 0;

  const rowTolerance = extentY * 2.5 + 24;
  let nearestRow = null;
  for (const other of NODES) {
    if (other.id === node.id) continue;
    if (Math.abs(other.y - node.y) > rowTolerance) continue;
    const dx = other.x - node.x;
    if (Math.abs(dx) < 1) continue;
    const distance = Math.abs(dx);
    if (!nearestRow || distance < nearestRow.distance) {
      nearestRow = { dx, distance };
    }
  }

  if (nearestRow) {
    const awaySide = nearestRow.dx > 0 ? "left" : "right";
    const towardSide = nearestRow.dx > 0 ? "right" : "left";
    if (side === awaySide) bias += 90;
    if (side === towardSide) bias -= 90;
  }

  const columnTolerance = extentX * 1.3 + 28;
  let nearestColumn = null;
  for (const other of NODES) {
    if (other.id === node.id) continue;
    if (Math.abs(other.x - node.x) > columnTolerance) continue;
    const dy = other.y - node.y;
    if (Math.abs(dy) < 1) continue;
    const distance = Math.abs(dy);
    if (!nearestColumn || distance < nearestColumn.distance) {
      nearestColumn = { dy, distance };
    }
  }

  if (nearestColumn) {
    const awaySide = nearestColumn.dy > 0 ? "top" : "bottom";
    const towardSide = nearestColumn.dy > 0 ? "bottom" : "top";
    if (side === awaySide) bias += 54;
    if (side === towardSide) bias -= 54;
  }

  if (side === "top") bias += 8;
  return bias;
}

function selfLoopObstaclePenalty(node, endpointId, side, extentX, extentY) {
  const { normal, tangent } = selfLoopSideVectors(side);
  const horizontalSide = side === "top" || side === "bottom";
  const laneHalfSpan = horizontalSide ? extentX * 0.9 + 24 : extentY * 1.1 + 24;

  let penalty = 0;
  for (const shape of collisionShapes) {
    if (shape.id === endpointId) continue;

    const bounds = collisionShapeBounds(shape);
    if (!bounds) continue;

    const centerX = (bounds.xMin + bounds.xMax) / 2;
    const centerY = (bounds.yMin + bounds.yMax) / 2;
    const vx = centerX - node.x;
    const vy = centerY - node.y;
    const forward = vx * normal.x + vy * normal.y;
    if (forward <= 0) continue;

    const lateral = Math.abs(vx * tangent.x + vy * tangent.y);
    const obstacleHalfSpan = horizontalSide
      ? (bounds.xMax - bounds.xMin) / 2
      : (bounds.yMax - bounds.yMin) / 2;
    const envelope = laneHalfSpan + obstacleHalfSpan + 12;
    if (lateral >= envelope) continue;

    penalty += (envelope - lateral) * 0.45 + 160 / Math.max(forward, 32);
  }

  return penalty;
}

function selectSelfLoopSide(node, endpointId, extentX, extentY) {
  const container = smallestContainingSection(node);
  const sides = ["top", "right", "bottom", "left"];

  let best = null;
  for (const side of sides) {
    const score = selfLoopBoundaryClearance(node, side, container) * 0.35
      + selfLoopNeighborBias(node, side, extentX, extentY)
      - selfLoopObstaclePenalty(node, endpointId, side, extentX, extentY);

    if (!best || score > best.score) best = { side, score };
  }

  return best?.side ?? "right";
}

function fallbackSelfLoopAnchors(node, side, extentX, extentY) {
  switch (side) {
    case "top":
      return {
        start: { x: node.x - extentX * 0.45, y: node.y - extentY },
        end: { x: node.x + extentX * 0.45, y: node.y - extentY },
      };
    case "right":
      return {
        start: { x: node.x + extentX, y: node.y - extentY * 0.45 },
        end: { x: node.x + extentX, y: node.y + extentY * 0.45 },
      };
    case "bottom":
      return {
        start: { x: node.x - extentX * 0.45, y: node.y + extentY },
        end: { x: node.x + extentX * 0.45, y: node.y + extentY },
      };
    case "left":
      return {
        start: { x: node.x - extentX, y: node.y - extentY * 0.45 },
        end: { x: node.x - extentX, y: node.y + extentY * 0.45 },
      };
    default:
      return {
        start: { x: node.x + extentX, y: node.y - extentY * 0.45 },
        end: { x: node.x + extentX, y: node.y + extentY * 0.45 },
      };
  }
}

function selectSelfLoopAnchors(endpointId, node, side, extentX, extentY) {
  const candidates = nodeEndpointCandidates(endpointId);
  if (candidates.length === 0) return fallbackSelfLoopAnchors(node, side, extentX, extentY);

  let band = [];
  if (side === "top") {
    const topY = Math.min(...candidates.map(p => p.y));
    band = candidates.filter(p => p.y <= topY + Math.max(6, extentY * 0.55));
    const ordered = [...band].sort((a, b) => a.x - b.x);
    if (ordered.length >= 2) return { start: ordered[0], end: ordered[ordered.length - 1] };
  }

  if (side === "right") {
    const rightX = Math.max(...candidates.map(p => p.x));
    band = candidates.filter(p => p.x >= rightX - Math.max(6, extentX * 0.3));
    const ordered = [...band].sort((a, b) => a.y - b.y);
    if (ordered.length >= 2) return { start: ordered[0], end: ordered[ordered.length - 1] };
  }

  if (side === "bottom") {
    const bottomY = Math.max(...candidates.map(p => p.y));
    band = candidates.filter(p => p.y >= bottomY - Math.max(6, extentY * 0.55));
    const ordered = [...band].sort((a, b) => a.x - b.x);
    if (ordered.length >= 2) return { start: ordered[0], end: ordered[ordered.length - 1] };
  }

  if (side === "left") {
    const leftX = Math.min(...candidates.map(p => p.x));
    band = candidates.filter(p => p.x <= leftX + Math.max(6, extentX * 0.3));
    const ordered = [...band].sort((a, b) => a.y - b.y);
    if (ordered.length >= 2) return { start: ordered[0], end: ordered[ordered.length - 1] };
  }

  return fallbackSelfLoopAnchors(node, side, extentX, extentY);
}

/**
 * Select start/end points for a self loop.
 * Sections keep a simple right-side loop.
 * Nodes pick the least crowded side, then use two dedicated anchors on that
 * side instead of reusing the generic port allocator.
 */
function selectSelfLoopEndpoints(endpointId, endpointInfo) {
  if (endpointInfo.isSection && endpointInfo.rect) {
    const rect = endpointInfo.rect;
    return {
      start: { x: rect.x + rect.w, y: rect.y + rect.h * 0.28 },
      end: { x: rect.x + rect.w, y: rect.y + rect.h * 0.72 },
      extentX: rect.w / 2,
      extentY: rect.h / 2,
      side: "right",
    };
  }

  const node = nodeMap[endpointId];
  if (!node) {
    return {
      start: { x: endpointInfo.x, y: endpointInfo.y - 20 },
      end: { x: endpointInfo.x, y: endpointInfo.y + 20 },
      extentX: 30,
      extentY: 20,
      side: "right",
    };
  }

  const sz = node._size || SHAPE_SIZES[node.shape];
  const extentX = sz.width ? sz.width / 2 : sz.rx;
  const extentY = sz.height ? sz.height / 2 : sz.ry;
  const side = selectSelfLoopSide(node, endpointId, extentX, extentY);
  const { start, end } = selectSelfLoopAnchors(endpointId, node, side, extentX, extentY);

  return {
    start,
    end,
    extentX,
    extentY,
    side,
  };
}

function computeSelfLoopLayout(endpointId, endpointInfo, offset) {
  let { start, end, extentX, extentY, side } = selectSelfLoopEndpoints(endpointId, endpointInfo);
  const horizontalSide = side === "top" || side === "bottom";

  if (horizontalSide) {
    if (start.x > end.x) [start, end] = [end, start];
    if (Math.abs(end.x - start.x) < 18) {
      const pad = Math.max(12, extentX * 0.22);
      start = { x: start.x - pad, y: start.y };
      end = { x: end.x + pad, y: end.y };
    }
  } else {
    if (start.y > end.y) [start, end] = [end, start];
    if (Math.abs(end.y - start.y) < 12) {
      const pad = Math.max(12, extentY * 0.45);
      start = { x: start.x, y: start.y - pad };
      end = { x: end.x, y: end.y + pad };
    }
  }

  const outward = Math.max(
    26,
    horizontalSide ? extentY * 0.82 : extentX * 0.72,
  ) + Math.abs(offset) * 1.5;

  let control1;
  let control2;
  let labelPos;
  switch (side) {
    case "top": {
      const loopY = Math.min(start.y, end.y) - outward;
      control1 = { x: start.x, y: loopY };
      control2 = { x: end.x, y: loopY };
      labelPos = { x: (start.x + end.x) / 2, y: loopY - 6 };
      break;
    }
    case "right": {
      const loopX = Math.max(start.x, end.x) + outward;
      control1 = { x: loopX, y: start.y };
      control2 = { x: loopX, y: end.y };
      labelPos = { x: loopX + 12, y: (start.y + end.y) / 2 - 5 };
      break;
    }
    case "bottom": {
      const loopY = Math.max(start.y, end.y) + outward;
      control1 = { x: start.x, y: loopY };
      control2 = { x: end.x, y: loopY };
      labelPos = { x: (start.x + end.x) / 2, y: loopY + 14 };
      break;
    }
    case "left":
    default: {
      const loopX = Math.min(start.x, end.x) - outward;
      control1 = { x: loopX, y: start.y };
      control2 = { x: loopX, y: end.y };
      labelPos = { x: loopX - 12, y: (start.y + end.y) / 2 - 5 };
      break;
    }
  }

  return {
    start,
    end,
    side,
    labelPos,
    path: `M ${start.x},${start.y} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${end.x},${end.y}`,
  };
}

function buildSelfLoopPath(edge, endpointId, endpointInfo, offset) {
  const layout = edge._selfLoopLayout ?? computeSelfLoopLayout(endpointId, endpointInfo, offset);
  edge._selfLoopLayout = layout;
  edge._selfLoopAnchors = { start: layout.start, end: layout.end };
  edge._selfLoopSide = layout.side;
  edge._labelPos = layout.labelPos;
  return layout.path;
}

function reserveSelfLoopLayouts() {
  for (const edge of EDGES) {
    edge._selfLoopLayout = null;
    edge._selfLoopAnchors = null;
    edge._selfLoopSide = null;

    if (edgeConnectionType(edge) !== EDGE_CONNECTION_TYPES.SELF) continue;

    const endpointInfo = resolveEndpoint(edge.source);
    if (!endpointInfo) continue;

    const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
    const offset = (index - (total - 1) / 2) * OFFSET_PX;
    const layout = computeSelfLoopLayout(edge.source, endpointInfo, offset);
    edge._selfLoopLayout = layout;
    edge._selfLoopAnchors = { start: layout.start, end: layout.end };
    edge._selfLoopSide = layout.side;

    if (!allocatedNodePorts.has(edge.source)) allocatedNodePorts.set(edge.source, []);
    allocatedNodePorts.get(edge.source).push(layout.start, layout.end);
  }
}

// ── Cross-panel corridor offset grouping ─────────────────────────────────
// Intra-panel edges rely on endpoint selection to separate themselves.
// Only cross-panel edges receive corridor offsets so their shared vertical
// trunks do not collapse onto the same x lane.
function computeOffsets() {
  const crossPanelEdges = [];
  EDGES.forEach(e => {
    const s = resolveEndpoint(e.source);
    const t = resolveEndpoint(e.target);
    const isCross = isFedAnchor(s) !== isFedAnchor(t);
    if (isCross) {
      crossPanelEdges.push(e);
    }
  });

  const offsets = {};
  // Globally sort cross-panel edges by combined Y so adjacent edges
  // receive adjacent corridor lanes spaced by MIN_GAP.
  crossPanelEdges.sort((a, b) => {
    const sa = resolveEndpoint(a.source), ta = resolveEndpoint(a.target);
    const sb = resolveEndpoint(b.source), tb = resolveEndpoint(b.target);
    return (sa.y + ta.y) - (sb.y + tb.y);
  });
  crossPanelEdges.forEach((e, i) => {
    offsets[e.id] = { index: i, total: crossPanelEdges.length };
  });

  return offsets;
}

const OFFSETS = computeOffsets();
const OFFSET_PX = ROUTING_OFFSET_PX;

/**
 * Build edge path with obstacle-aware routing:
 * - Cross-panel (Fed ↔ Market): orthogonal routing via corridor
 * - Intra-panel straight: when line-of-sight is clear
 * - Intra-panel polyline: when straight line crosses intermediate shapes (max 2 turns)
 * Stores _labelPos for efficient label placement.
 */
function edgePath(edge) {
  const srcInfo = resolveEndpoint(edge.source);
  const tgtInfo = resolveEndpoint(edge.target);
  if (!srcInfo || !tgtInfo) { edge._labelPos = { x: 0, y: 0 }; return ""; }
  edge._waypoints = null;
  edge._selfLoopAnchors = null;
  edge._selfLoopSide = null;
  const sourceOwner = ownerShapeForEndpoint(edge.source, srcInfo);
  const targetOwner = ownerShapeForEndpoint(edge.target, tgtInfo);
  const ownerOptions = { startOwner: sourceOwner, endOwner: targetOwner };
  const routeContextBase = { sourceInfo: srcInfo, targetInfo: tgtInfo, sourceOwner, targetOwner };

  const connectionType = edgeConnectionType(edge);
  const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
  const step = OFFSET_PX;
  const offset = (index - (total - 1) / 2) * step;

  if (connectionType === EDGE_CONNECTION_TYPES.SELF) {
    return buildSelfLoopPath(edge, edge.source, srcInfo, offset);
  }

  const srcIsSec = edge.source.startsWith("sec:");
  const tgtIsSec = edge.target.startsWith("sec:");
  const excludeIds = new Set();
  if (!srcIsSec) excludeIds.add(edge.source);
  if (!tgtIsSec) excludeIds.add(edge.target);

  const crossPanel = isFedAnchor(srcInfo) !== isFedAnchor(tgtInfo);

  const srcAllocated = allocatedNodePorts.get(edge.source) || [];
  const tgtAllocated = allocatedNodePorts.get(edge.target) || [];
  const srcCandidates = endpointCandidates(edge.source, srcInfo);
  const tgtCandidates = endpointCandidates(edge.target, tgtInfo);

  let pair;
  if (srcIsSec && srcInfo.rect) {
    const secCandidates = sectionEndpointCandidates(srcInfo.rect);
    pair = selectBestEndpointPair(secCandidates, tgtCandidates, {
      sourceInfo: srcInfo,
      targetInfo: tgtInfo,
      excludeIds,
      crossPanel,
      sourceOwner,
      targetOwner,
      sourceAllocated: srcAllocated,
      targetAllocated: tgtAllocated,
    });
  } else if (tgtIsSec && tgtInfo.rect) {
    const secCandidates = sectionEndpointCandidates(tgtInfo.rect);
    const reversePair = selectBestEndpointPair(secCandidates, srcCandidates, {
      sourceInfo: tgtInfo,
      targetInfo: srcInfo,
      excludeIds,
      crossPanel,
      sourceOwner: targetOwner,
      targetOwner: sourceOwner,
      sourceAllocated: tgtAllocated,
      targetAllocated: srcAllocated,
    });
    pair = { start: reversePair.end, end: reversePair.start, cost: reversePair.cost };
  } else {
    pair = selectBestEndpointPair(srcCandidates, tgtCandidates, {
      sourceInfo: srcInfo,
      targetInfo: tgtInfo,
      excludeIds,
      crossPanel,
      sourceOwner,
      targetOwner,
      sourceAllocated: srcAllocated,
      targetAllocated: tgtAllocated,
    });
  }

  // Record allocated ports so subsequent edges keep ≥MIN_GAP spacing
  if (!allocatedNodePorts.has(edge.source)) allocatedNodePorts.set(edge.source, []);
  if (!allocatedNodePorts.has(edge.target)) allocatedNodePorts.set(edge.target, []);
  allocatedNodePorts.get(edge.source).push(pair.start);
  allocatedNodePorts.get(edge.target).push(pair.end);

  const sp = pair.start;
  const tp = pair.end;
  const s = { x: srcInfo.x, y: srcInfo.y };
  const t = { x: tgtInfo.x, y: tgtInfo.y };

  // ── Cross-panel routing (Fed ↔ Market) — always orthogonal via corridor ──
  if (crossPanel) {
    const cx = CORRIDOR_X + offset;
    const pts = normalizeWaypoints([
      { x: sp.x, y: sp.y },
      { x: cx, y: sp.y },
      { x: cx, y: tp.y },
      { x: tp.x, y: tp.y },
    ]);
    edge._waypoints = pts;
    rememberRoutedSegments(edge.id, pts);
    edge._labelPos = { x: cx + 10, y: (sp.y + tp.y) / 2 };
    return pointsToPath(pts);
  }

  // ── Intra-panel routing with obstacle detection ─────────────────────
  const startX = sp.x, startY = sp.y;
  const endX = tp.x, endY = tp.y;

  // Only allow straight line when axis-aligned (same x ±2 or same y ±2) and ≥5px apart
  const ALIGN_TOL = 2, MIN_EDGE_LEN = 5;
  const axisAligned = Math.abs(startX - endX) < ALIGN_TOL || Math.abs(startY - endY) < ALIGN_TOL;
  const edgeLen = Math.abs(startX - endX) + Math.abs(startY - endY);

  if (offset === 0 && axisAligned && edgeLen >= MIN_EDGE_LEN &&
      !isPolylineBlocked([{ x: startX, y: startY }, { x: endX, y: endY }], excludeIds, ownerOptions)) {
    // Axis-aligned clear line-of-sight → straight line
    edge._waypoints = normalizeWaypoints([{ x: startX, y: startY }, { x: endX, y: endY }]);
    rememberRoutedSegments(edge.id, edge._waypoints);
    edge._labelPos = { x: (startX + endX) / 2, y: (startY + endY) / 2 - 5 };
    return `M ${startX},${startY} L ${endX},${endY}`;
  }

  // ── Polyline routing (max 2 turns) ──────────────────────────────────
  const polyline = findPolylineRoute(startX, startY, endX, endY, excludeIds, offset, {
    ...routeContextBase,
    crossPanel,
    ownerOptions,
  });
  const pts = polyline.waypoints;
  edge._waypoints = pts;
  rememberRoutedSegments(edge.id, pts);
  edge._labelPos = polyline.labelPos;

  return pointsToPath(pts);
}

/**
 * Find safe corridors perpendicular to the main axis of travel.
 * Scans all collision shapes in the sweep range and finds x (or y) positions
 * that are clear of any obstacles.
 * @param {number} sweepMin - min on the sweep axis (e.g. yMin for vertical corridors)
 * @param {number} sweepMax - max on the sweep axis
 * @param {'x'|'y'} corridorAxis - which axis we want safe positions for
 * @param {Set<string>} excludeIds - node IDs to skip
 * @param {number} margin - extra clearance (px)
 * @returns {number[]} safe positions on corridorAxis, sorted by distance from midpoint
 */
function findSafeCorridors(sweepMin, sweepMax, corridorAxis, excludeIds, margin = 12) {
  const blocked = [];
  for (const s of collisionShapes) {
    if (excludeIds.has(s.id)) continue;
    let sMin, sMax, bMin, bMax;
    switch (s.type) {
      case "rect":
        if (corridorAxis === 'x') {
          sMin = s.yMin; sMax = s.yMax; bMin = s.xMin; bMax = s.xMax;
        } else {
          sMin = s.xMin; sMax = s.xMax; bMin = s.yMin; bMax = s.yMax;
        }
        break;
      case "polygon": {
        sMin = Infinity; sMax = -Infinity; bMin = Infinity; bMax = -Infinity;
        for (const v of s.verts) {
          const sv = corridorAxis === 'x' ? v.y : v.x;
          const bv = corridorAxis === 'x' ? v.x : v.y;
          if (sv < sMin) sMin = sv; if (sv > sMax) sMax = sv;
          if (bv < bMin) bMin = bv; if (bv > bMax) bMax = bv;
        }
        break;
      }
      case "ellipse":
        if (corridorAxis === 'x') {
          sMin = s.cy - s.ry; sMax = s.cy + s.ry; bMin = s.cx - s.rx; bMax = s.cx + s.rx;
        } else {
          sMin = s.cx - s.rx; sMax = s.cx + s.rx; bMin = s.cy - s.ry; bMax = s.cy + s.ry;
        }
        break;
    }
    if (sMax > sweepMin && sMin < sweepMax) {
      blocked.push({ min: bMin, max: bMax });
    }
  }
  if (blocked.length === 0) return [];

  // Sort and merge overlapping blocked ranges
  blocked.sort((a, b) => a.min - b.min);
  const merged = [{ ...blocked[0] }];
  for (let i = 1; i < blocked.length; i++) {
    const last = merged[merged.length - 1];
    if (blocked[i].min <= last.max + margin) {
      last.max = Math.max(last.max, blocked[i].max);
    } else {
      merged.push({ ...blocked[i] });
    }
  }

  // Collect safe positions: outside merged ranges and in gaps
  let safe = [];
  safe.push(merged[0].min - margin);
  safe.push(merged[merged.length - 1].max + margin);
  for (let i = 0; i < merged.length - 1; i++) {
    const gap = merged[i + 1].min - merged[i].max;
    if (gap > margin * 2) {
      safe.push((merged[i].max + merged[i + 1].min) / 2);
    }
  }
  const used = usedCorridors.get(corridorAxis) || [];
  if (used.length > 0) {
    const filtered = safe.filter(pos => used.every(u => Math.abs(pos - u) >= MIN_GAP));
    if (filtered.length > 0) safe = filtered;
  }
  return safe;
}

function buildAxisAlignedOffsetLane(sx, sy, ex, ey, offset) {
  if (Math.abs(offset) <= 0.1) return null;

  if (Math.abs(sy - ey) < 2) {
    const dir = Math.sign(ex - sx) || 1;
    const laneY = sy + offset;
    const maxTangent = Math.abs(ex - sx) / 2 - 4;
    if (maxTangent < 4) return null;

    const tangent = Math.min(Math.max(12, Math.abs(offset) * 2), maxTangent);
    return {
      waypoints: [
        { x: sx, y: sy },
        { x: sx + dir * tangent, y: sy },
        { x: sx + dir * tangent, y: laneY },
        { x: ex - dir * tangent, y: laneY },
        { x: ex - dir * tangent, y: ey },
        { x: ex, y: ey },
      ],
      labelPos: { x: (sx + ex) / 2, y: laneY - 5 },
    };
  }

  if (Math.abs(sx - ex) < 2) {
    const dir = Math.sign(ey - sy) || 1;
    const laneX = sx + offset;
    const maxTangent = Math.abs(ey - sy) / 2 - 4;
    if (maxTangent < 4) return null;

    const tangent = Math.min(Math.max(12, Math.abs(offset) * 2), maxTangent);
    return {
      waypoints: [
        { x: sx, y: sy },
        { x: sx, y: sy + dir * tangent },
        { x: laneX, y: sy + dir * tangent },
        { x: laneX, y: ey - dir * tangent },
        { x: ex, y: ey - dir * tangent },
        { x: ex, y: ey },
      ],
      labelPos: { x: laneX + 10, y: (sy + ey) / 2 - 5 },
    };
  }

  return null;
}

/**
 * Find the best polyline route (max 2 turns) between two points.
 * Tries L-shapes (1 turn) first, then Z-shapes (2 turns), then dynamic corridors.
 * Each segment is axis-aligned (horizontal or vertical).
 */
function findPolylineRoute(sx, sy, ex, ey, excludeIds, offset, routeContext = {}) {
  const dx = ex - sx, dy = ey - sy;
  const preferredMidX = (sx + ex) / 2 + offset;
  const preferredMidY = (sy + ey) / 2 + offset;
  const ownerOptions = routeContext.ownerOptions ?? {};
  let best = null;

  function considerCandidate(waypoints, labelPos, corridorAxis = null, corridorPos = null, extraPenalty = 0) {
    const normalized = normalizeWaypoints(waypoints);
    if (isPolylineBlocked(normalized, excludeIds, ownerOptions)) return;

    const cost = polylineLength(normalized) + routePenalty(normalized, routeContext) + extraPenalty;
    if (!best || cost < best.cost) {
      best = { waypoints: normalized, labelPos, cost, corridorAxis, corridorPos };
    }
  }

  const offsetLane = buildAxisAlignedOffsetLane(sx, sy, ex, ey, offset);
  if (offsetLane) {
    considerCandidate(offsetLane.waypoints, offsetLane.labelPos, null, null, 120);
  }

  // ── L-shape candidates (1 turn) ──
  const lCandidates = [
    // H then V
    [{ x: sx, y: sy }, { x: ex, y: sy }, { x: ex, y: ey }],
    // V then H
    [{ x: sx, y: sy }, { x: sx, y: ey }, { x: ex, y: ey }],
  ];

  for (const pts of lCandidates) {
    considerCandidate(pts, { x: pts[1].x, y: pts[1].y - 5 });
  }

  // ── Z-shape candidates (2 turns) ──
  // Try multiple mid-positions to find a clear path
  const midFractions = [0.5, 0.33, 0.67, 0.25, 0.75];
  const zCandidates = [];

  for (const frac of midFractions) {
    // H-V-H
    const midY = sy + dy * frac + offset;
    zCandidates.push([
      { x: sx, y: sy }, { x: sx, y: midY }, { x: ex, y: midY }, { x: ex, y: ey }
    ]);
    // V-H-V
    const midX = sx + dx * frac + offset;
    zCandidates.push([
      { x: sx, y: sy }, { x: midX, y: sy }, { x: midX, y: ey }, { x: ex, y: ey }
    ]);
  }

  // Side jogs with extended range
  const sideJogs = [40, -40, 80, -80, 120, -120, 160, -160];
  for (const jog of sideJogs) {
    const midY = preferredMidY + jog;
    zCandidates.push([
      { x: sx, y: sy }, { x: sx, y: midY }, { x: ex, y: midY }, { x: ex, y: ey }
    ]);
    const midX = preferredMidX + jog;
    zCandidates.push([
      { x: sx, y: sy }, { x: midX, y: sy }, { x: midX, y: ey }, { x: ex, y: ey }
    ]);
  }

  for (const pts of zCandidates) {
    const midSeg = Math.floor(pts.length / 2);
    considerCandidate(pts, {
      x: (pts[midSeg - 1].x + pts[midSeg].x) / 2,
      y: (pts[midSeg - 1].y + pts[midSeg].y) / 2 - 5,
    });
  }

  // ── Dynamic corridor routing ──
  // Compute safe x-corridors (for vertical travel) and y-corridors (for horizontal)

  // Safe vertical corridors (find clear x positions)
  const safeX = findSafeCorridors(Math.min(sy, ey), Math.max(sy, ey), 'x', excludeIds);
  // Sort by distance from midpoint of start/end x
  const mx = preferredMidX;
  safeX.sort((a, b) => Math.abs(a - mx) - Math.abs(b - mx));
  for (const cx of safeX) {
    const pts = [{ x: sx, y: sy }, { x: cx, y: sy }, { x: cx, y: ey }, { x: ex, y: ey }];
    considerCandidate(pts, { x: cx + 10, y: (sy + ey) / 2 - 5 }, 'x', cx, 40);
  }

  // Safe horizontal corridors (find clear y positions)
  const safeY = findSafeCorridors(Math.min(sx, ex), Math.max(sx, ex), 'y', excludeIds);
  const my = preferredMidY;
  safeY.sort((a, b) => Math.abs(a - my) - Math.abs(b - my));
  for (const cy of safeY) {
    const pts = [{ x: sx, y: sy }, { x: sx, y: cy }, { x: ex, y: cy }, { x: ex, y: ey }];
    considerCandidate(pts, { x: (sx + ex) / 2, y: cy - 5 }, 'y', cy, 40);
  }

  if (best) {
    if (best.corridorAxis) {
      usedCorridors.set(best.corridorAxis, [...(usedCorridors.get(best.corridorAxis) || []), best.corridorPos]);
    }
    return best;
  }

  // Fallback: use the first L-shape even though it's blocked
  const fallback = lCandidates[Math.abs(dx) >= Math.abs(dy) ? 0 : 1];
  return {
    waypoints: fallback,
    labelPos: { x: fallback[1].x, y: fallback[1].y - 5 },
  };
}

/** Label position — uses the _labelPos computed by edgePath. */
function labelPos(edge) {
  return edge._labelPos || { x: 0, y: 0 };
}

/** Get resolved hex color for an edge. */
function edgeColor(edge) {
  return EDGE_COLORS[edge.color]?.color ?? "#999";
}

/**
 * Define arrowhead markers (one per edge color).
 */
export function defineMarkers(defs) {
  for (const [id, cfg] of Object.entries(EDGE_COLORS)) {
    defs.append("marker")
      .attr("id", `arrow-${id}`)
      .attr("viewBox", "0 0 10 6")
      .attr("refX", 9)
      .attr("refY", 3)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
        .attr("d", "M0,0 L10,3 L0,6 Z")
        .attr("fill", cfg.color);
  }
}

/**
 * Render edge paths and labels into the given layer.
 */
export function renderEdges(layer, { onEdgeHover, onEdgeOut }) {
  // Reset global allocation state before each full re-render
  usedPorts.clear();
  allocatedNodePorts.clear();
  usedCorridors.clear();
  routedSegments.length = 0;
  reserveSelfLoopLayouts();

  // Pre-compute all edge paths in a single port-allocation pass
  // (avoids inconsistency from calling edgePath/labelPos multiple times)
  EDGES.forEach(e => { e._path = edgePath(e); });

  const g = layer.selectAll("g.edge")
    .data(EDGES, d => d.id)
    .join("g")
      .attr("class", "edge");

  // Path — straight, orthogonal, or curve
  g.append("path")
    .attr("class", "edge-stroke")
    .attr("d", d => d._path)
    .attr("fill", "none")
    .attr("stroke", edgeColor)
    .attr("stroke-width", EMPTY_VALUE_STROKE_WIDTH)
    .attr("stroke-linejoin", "round")
    .attr("marker-end", d => `url(#arrow-${d.color})`)
    .attr("marker-start", d => d.connectionType === EDGE_CONNECTION_TYPES.BIDIRECTIONAL ? `url(#arrow-${d.color})` : null);

  g.each(function (d) {
    const anchors = d._selfLoopAnchors
      ? [
        { role: "start", ...d._selfLoopAnchors.start },
        { role: "end", ...d._selfLoopAnchors.end },
      ]
      : [];

    d3.select(this)
      .selectAll("circle.self-loop-anchor")
      .data(anchors, anchor => anchor.role)
      .join("circle")
        .attr("class", anchor => `self-loop-anchor self-loop-anchor-${anchor.role}`)
        .attr("cx", anchor => anchor.x)
        .attr("cy", anchor => anchor.y)
        .attr("r", anchor => anchor.role === "end" ? 2.8 : 2.3)
        .attr("fill", "#fff")
        .attr("stroke", () => edgeColor(d))
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.95)
        .attr("pointer-events", "none");
  });

  // Value label background
  g.append("rect")
    .attr("class", "edge-label-bg")
    .attr("rx", 3).attr("ry", 3)
    .attr("fill", "#fff")
    .attr("opacity", 0.88)
    .attr("visibility", "hidden");

  // Hover target (invisible wider path for easy hovering)
  g.append("path")
    .attr("class", "edge-hover-zone")
    .attr("d", d => d._path)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", HOVER_WIDTH)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => { if (!isSelecting()) onEdgeHover?.(d, event); })
    .on("mouseleave", () => onEdgeOut?.());

  // Value label — L7: Edge flow label (rendered AFTER hover-zone → on top, selectable)
  g.append("text")
    .attr("class", "edge-label")
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")   /* L7 — var(--fs-edge-label) in diagram.css */
    .attr("font-weight", "600")
    .attr("fill", "#333")
    .attr("pointer-events", "auto")
    .each(function (d) {
      const pos = labelPos(d);
      d3.select(this).attr("x", pos.x).attr("y", pos.y);
    });

  return g;
}

/**
 * Update edge value labels.
 */
export function updateEdgeLabels(edgeGroup, values, metadata, formatValue) {
  edgeGroup.each(function (d) {
    const g = d3.select(this);
    const textEl = g.select(".edge-label");
    const bgEl   = g.select(".edge-label-bg");
    const pathEl = g.select(".edge-stroke");

    let display = "";

    textEl.text(display);
    pathEl.attr("stroke-width", display ? EDGE_STROKE_WIDTH : EMPTY_VALUE_STROKE_WIDTH);

    if (display) {
      const bbox = textEl.node().getBBox();
      bgEl.attr("x", bbox.x - 3)
          .attr("y", bbox.y - 1)
          .attr("width", bbox.width + 6)
          .attr("height", bbox.height + 2)
          .attr("visibility", "visible");
    } else {
      bgEl.attr("visibility", "hidden");
    }
  });
}
