/**
 * edges.js — D3 rendering of directed funding flow edges.
 * Self-loop arcs plus orthogonal connected-edge routing with port-based points.
 * Each node shape exposes multiple ports; the router assigns a unique port per edge,
 * guaranteeing that each connection point is used by at most one edge.
 */
import { EDGES, NODES, EDGE_COLORS, EDGE_CONNECTION_TYPES, SHAPE_SIZES, SECTIONS } from "./constants.js";
import { isSelecting } from "./tooltip.js";

const FED_PANEL_RIGHT = 520;
const CORRIDOR_X = 530;

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

  const sz = SHAPE_SIZES[node.shape];
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
  sectionEndpointCache.set(key, deduped);
  return deduped;
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

function pointDirectionPenalty(point, ownerInfo, targetInfo, crossPanel) {
  const dx = targetInfo.x - ownerInfo.x;
  const dy = targetInfo.y - ownerInfo.y;
  const penalty = crossPanel ? 180 : 80;

  if (crossPanel || Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0 && point.x < ownerInfo.x - 1) return penalty;
    if (dx < 0 && point.x > ownerInfo.x + 1) return penalty;
    return 0;
  }

  if (dy >= 0 && point.y < ownerInfo.y - 1) return penalty;
  if (dy < 0 && point.y > ownerInfo.y + 1) return penalty;
  return 0;
}

function pathCandidateCost(points, excludeIds, blockedPenalty) {
  const normalized = normalizeWaypoints(points);
  return polylineLength(normalized)
    + polylineTurnCount(normalized) * 40
    + (isPolylineBlocked(normalized, excludeIds) ? blockedPenalty : 0);
}

function estimateEndpointPairCost(start, end, excludeIds, crossPanel) {
  const aligned = Math.abs(start.x - end.x) < 2 || Math.abs(start.y - end.y) < 2;

  if (crossPanel) {
    return pathCandidateCost([
      start,
      { x: CORRIDOR_X, y: start.y },
      { x: CORRIDOR_X, y: end.y },
      end,
    ], excludeIds, 2400);
  }

  let best = Infinity;
  if (aligned && !isSegmentBlocked(start.x, start.y, end.x, end.y, excludeIds)) {
    best = Math.min(best, Math.abs(start.x - end.x) + Math.abs(start.y - end.y) - 120);
  }

  const lCandidates = [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
  ];
  for (const points of lCandidates) {
    if (!isPolylineBlocked(points, excludeIds)) {
      best = Math.min(best, polylineLength(points) + polylineTurnCount(points) * 40);
    }
  }

  if (!Number.isFinite(best)) {
    const fallback = findPolylineRoute(start.x, start.y, end.x, end.y, excludeIds, 0);
    best = pathCandidateCost(fallback.waypoints, excludeIds, 3200) + 120;
  }

  return best;
}

function trimCandidatePool(candidates, targetInfo, limit = 32) {
  if (candidates.length <= limit) return candidates;
  return [...candidates]
    .sort((a, b) => {
      const da = Math.abs(a.x - targetInfo.x) + Math.abs(a.y - targetInfo.y);
      const db = Math.abs(b.x - targetInfo.x) + Math.abs(b.y - targetInfo.y);
      return da - db;
    })
    .slice(0, limit);
}

function selectBestEndpointPair(sourceCandidates, targetCandidates, options) {
  const { sourceInfo, targetInfo, excludeIds, crossPanel } = options;
  const sourcePool = trimCandidatePool(sourceCandidates, targetInfo);
  const targetPool = trimCandidatePool(targetCandidates, sourceInfo);

  let best = null;
  for (const start of sourcePool) {
    for (const end of targetPool) {
      const cost = estimateEndpointPairCost(start, end, excludeIds, crossPanel)
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

const PAD = 4; // padding around shapes for collision detection

/** Pre-compute collision primitives for all nodes. */
const collisionShapes = NODES.map(n => {
  const sz = SHAPE_SIZES[n.shape];
  if (n.shape === "hexagon") {
    const rx = sz.rx + PAD, ry = sz.ry + PAD;
    const verts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      verts.push({ x: n.x + rx * Math.cos(a), y: n.y + ry * Math.sin(a) });
    }
    return { id: n.id, type: "polygon", verts };
  }
  if (n.shape === "circle") {
    return { id: n.id, type: "ellipse", cx: n.x, cy: n.y, rx: sz.rx + PAD, ry: sz.ry + PAD };
  }
  // Rectangle shapes: rectangle, bs_parent, bs_child
  const w = sz.width, h = sz.height;
  return {
    id: n.id, type: "rect",
    xMin: n.x - w / 2 - PAD, yMin: n.y - h / 2 - PAD,
    xMax: n.x + w / 2 + PAD, yMax: n.y + h / 2 + PAD,
  };
});

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
  return false;
}

/** Check if a polyline (array of {x,y} waypoints) is blocked. */
function isPolylineBlocked(waypoints, excludeIds) {
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (isSegmentBlocked(waypoints[i].x, waypoints[i].y,
                         waypoints[i+1].x, waypoints[i+1].y, excludeIds))
      return true;
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
    indices.push({ i, dist: dx * dx + dy * dy }); // squared distance for sorting
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
      const d = dx * dx + dy * dy;
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

/**
 * Select start/end points for a self loop.
 * Node loops leave and re-enter from the outer-right side; section loops use
 * two points on the rectangle's right edge.
 */
function selectSelfLoopEndpoints(endpointId, endpointInfo) {
  if (endpointInfo.isSection && endpointInfo.rect) {
    const rect = endpointInfo.rect;
    return {
      start: { x: rect.x + rect.w, y: rect.y + rect.h * 0.28 },
      end: { x: rect.x + rect.w, y: rect.y + rect.h * 0.72 },
      extentX: rect.w / 2,
      extentY: rect.h / 2,
    };
  }

  const node = nodeMap[endpointId];
  if (!node) {
    return {
      start: { x: endpointInfo.x, y: endpointInfo.y - 20 },
      end: { x: endpointInfo.x, y: endpointInfo.y + 20 },
      extentX: 30,
      extentY: 20,
    };
  }

  const sz = SHAPE_SIZES[node.shape];
  const extentX = sz.width ? sz.width / 2 : sz.rx;
  const extentY = sz.height ? sz.height / 2 : sz.ry;
  const loopTargetX = node.x + extentX + 2000;

  return {
    start: allocatePort(endpointId, loopTargetX, node.y - extentY, "out"),
    end: allocatePort(endpointId, loopTargetX, node.y + extentY, "in"),
    extentX,
    extentY,
  };
}

function buildSelfLoopPath(edge, endpointId, endpointInfo, offset) {
  let { start, end, extentX, extentY } = selectSelfLoopEndpoints(endpointId, endpointInfo);
  if (start.y > end.y) [start, end] = [end, start];

  if (Math.abs(end.y - start.y) < 12) {
    const pad = Math.max(12, extentY * 0.45);
    start = { x: start.x, y: start.y - pad };
    end = { x: end.x, y: end.y + pad };
  }

  const loopX = Math.max(start.x, end.x) + Math.max(42, extentX * 0.7) + Math.abs(offset) * 2;
  const handleY = Math.max(16, extentY * 0.3);

  edge._labelPos = { x: loopX + 12, y: (start.y + end.y) / 2 - 5 };
  return `M ${start.x},${start.y} C ${loopX},${start.y - handleY} ${loopX},${end.y + handleY} ${end.x},${end.y}`;
}

// ── Parallel-edge offset grouping ────────────────────────────────────────
// Edges sharing the same UNORDERED pair (A↔B) get a unique offset so
// bidirectional edges between the same nodes don't overlap.
function computeOffsets() {
  const biGroups = {};
  EDGES.forEach(e => {
    const biKey = [e.source, e.target].sort().join('|');
    (biGroups[biKey] ??= []).push(e.id);
  });
  const offsets = {};
  for (const ids of Object.values(biGroups)) {
    ids.forEach((id, i) => {
      offsets[id] = { index: i, total: ids.length };
    });
  }
  return offsets;
}

const OFFSETS = computeOffsets();
const OFFSET_PX = 8;

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

  const connectionType = edgeConnectionType(edge);
  const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
  const step = Math.min(OFFSET_PX, Math.max(4, 60 / total));
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
  const srcCandidates = endpointCandidates(edge.source, srcInfo);
  const tgtCandidates = endpointCandidates(edge.target, tgtInfo);

  let pair;
  if (srcIsSec && srcInfo.rect) {
    pair = sectionEdgePoint(srcInfo.rect, tgtCandidates, {
      sourceInfo: srcInfo,
      targetInfo: tgtInfo,
      excludeIds,
      crossPanel,
    });
  } else if (tgtIsSec && tgtInfo.rect) {
    const reversePair = sectionEdgePoint(tgtInfo.rect, srcCandidates, {
      sourceInfo: tgtInfo,
      targetInfo: srcInfo,
      excludeIds,
      crossPanel,
    });
    pair = { start: reversePair.end, end: reversePair.start, cost: reversePair.cost };
  } else {
    pair = selectBestEndpointPair(srcCandidates, tgtCandidates, {
      sourceInfo: srcInfo,
      targetInfo: tgtInfo,
      excludeIds,
      crossPanel,
    });
  }

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
      !isSegmentBlocked(startX, startY, endX, endY, excludeIds)) {
    // Axis-aligned clear line-of-sight → straight line
    edge._labelPos = { x: (startX + endX) / 2, y: (startY + endY) / 2 - 5 };
    return `M ${startX},${startY} L ${endX},${endY}`;
  }

  // ── Polyline routing (max 2 turns) ──────────────────────────────────
  // Generate candidate routes and pick the first unblocked one.
  const polyline = findPolylineRoute(startX, startY, endX, endY, excludeIds, offset);
  const pts = polyline.waypoints;
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
  const safe = [];
  safe.push(merged[0].min - margin);
  safe.push(merged[merged.length - 1].max + margin);
  for (let i = 0; i < merged.length - 1; i++) {
    const gap = merged[i + 1].min - merged[i].max;
    if (gap > margin * 2) {
      safe.push((merged[i].max + merged[i + 1].min) / 2);
    }
  }
  return safe;
}

/**
 * Find the best polyline route (max 2 turns) between two points.
 * Tries L-shapes (1 turn) first, then Z-shapes (2 turns), then dynamic corridors.
 * Each segment is axis-aligned (horizontal or vertical).
 */
function findPolylineRoute(sx, sy, ex, ey, excludeIds, offset) {
  const dx = ex - sx, dy = ey - sy;
  const preferredMidX = (sx + ex) / 2 + offset;
  const preferredMidY = (sy + ey) / 2 + offset;

  // ── L-shape candidates (1 turn) ──
  const lCandidates = [
    // H then V
    [{ x: sx, y: sy }, { x: ex, y: sy }, { x: ex, y: ey }],
    // V then H
    [{ x: sx, y: sy }, { x: sx, y: ey }, { x: ex, y: ey }],
  ];

  for (const pts of lCandidates) {
    if (!isPolylineBlocked(pts, excludeIds)) {
      return {
        waypoints: pts,
        labelPos: { x: pts[1].x, y: pts[1].y - 5 }, // label at corner
      };
    }
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
    if (!isPolylineBlocked(pts, excludeIds)) {
      const midSeg = Math.floor(pts.length / 2);
      return {
        waypoints: pts,
        labelPos: {
          x: (pts[midSeg - 1].x + pts[midSeg].x) / 2,
          y: (pts[midSeg - 1].y + pts[midSeg].y) / 2 - 5,
        },
      };
    }
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
    if (!isPolylineBlocked(pts, excludeIds)) {
      return {
        waypoints: pts,
        labelPos: { x: cx + 10, y: (sy + ey) / 2 - 5 },
      };
    }
  }

  // Safe horizontal corridors (find clear y positions)
  const safeY = findSafeCorridors(Math.min(sx, ex), Math.max(sx, ex), 'y', excludeIds);
  const my = preferredMidY;
  safeY.sort((a, b) => Math.abs(a - my) - Math.abs(b - my));
  for (const cy of safeY) {
    const pts = [{ x: sx, y: sy }, { x: sx, y: cy }, { x: ex, y: cy }, { x: ex, y: ey }];
    if (!isPolylineBlocked(pts, excludeIds)) {
      return {
        waypoints: pts,
        labelPos: { x: (sx + ex) / 2, y: cy - 5 },
      };
    }
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
      .attr("orient", "auto")
      .append("path")
        .attr("d", "M0,0 L10,3 L0,6 Z")
        .attr("fill", cfg.color);
  }
}

/**
 * Render edge paths and labels into the given layer.
 */
export function renderEdges(layer, { onEdgeHover, onEdgeOut }) {
  // Reset port allocations before each full re-render
  usedPorts.clear();

  // Pre-compute all edge paths in a single port-allocation pass
  // (avoids inconsistency from calling edgePath/labelPos multiple times)
  EDGES.forEach(e => { e._path = edgePath(e); });

  const g = layer.selectAll("g.edge")
    .data(EDGES, d => d.id)
    .join("g")
      .attr("class", "edge");

  // Path — straight, orthogonal, or curve
  g.append("path")
    .attr("d", d => d._path)
    .attr("fill", "none")
    .attr("stroke", edgeColor)
    .attr("stroke-width", 1.6)
    .attr("stroke-linejoin", "round")
    .attr("marker-end", d => `url(#arrow-${d.color})`);

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
    .attr("stroke-width", 14)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => { if (!isSelecting()) onEdgeHover?.(d, event); })
    .on("mouseleave", () => onEdgeOut?.());

  // Value label — L7: Edge flow label (rendered AFTER hover-zone → on top, selectable)
  g.append("text")
    .attr("class", "edge-label")
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")   /* L7 — var(--fs-edge-label) in diagram.css */
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

    let display = "";

    textEl.text(display);

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
