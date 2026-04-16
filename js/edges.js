/**
 * edges.js — D3 rendering of directed funding flow edges.
 * Orthogonal (polyline / L-shaped) routing with port-based connection points.
 * Each node shape exposes multiple ports; the router assigns a unique port per edge,
 * guaranteeing that each connection point is used by at most one edge.
 */
import { EDGES, NODES, EDGE_COLORS, SHAPE_PORTS, SHAPE_SIZES, SECTIONS } from "./constants.js";
import { isSelecting } from "./tooltip.js";

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

/**
 * Compute the connection point on a section's edge facing toward (targetX, targetY).
 * Returns {x, y} on the rectangle perimeter.
 */
function sectionEdgePoint(rect, targetX, targetY) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  // Degenerate case
  if (dx === 0 && dy === 0) return { x: cx, y: rect.y }; // default to top edge

  // Find which edge the ray from center to target hits
  // Parametric: center + t * (dx, dy), find t where it intersects rect bounds
  let tMin = Infinity;
  let hitX = cx, hitY = rect.y;

  // Four edges of the rectangle
  const candidates = [
    { nx: 1, ny: 0, val: rect.x + rect.w },  // right
    { nx: -1, ny: 0, val: rect.x },           // left
    { nx: 0, ny: 1, val: rect.y + rect.h },   // bottom
    { nx: 0, ny: -1, val: rect.y },           // top
  ];

  for (const e of candidates) {
    const denom = e.nx * dx + e.ny * dy;
    if (Math.abs(denom) < 1e-6) continue; // parallel
    const t = (e.val - (e.nx * cx + e.ny * cy)) / denom;
    if (t > 0 && t < tMin) {
      const px = cx + t * dx;
      const py = cy + t * dy;
      // Check if point is within edge segment
      if (px >= rect.x - 1 && px <= rect.x + rect.w + 1 &&
          py >= rect.y - 1 && py <= rect.y + rect.h + 1) {
        tMin = t;
        hitX = px;
        hitY = py;
      }
    }
  }

  return { x: hitX, y: hitY };
}

const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

// ── Section map for region-edge connections ─────────────────────────────
const sectionMap = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

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

  const ports = SHAPE_PORTS[node.shape];
  if (!ports || ports.length === 0) return { x: node.x, y: node.y };

  const key = `${nodeId}_${dir}`;
  if (!usedPorts.has(key)) usedPorts.set(key, new Set());
  const taken = usedPorts.get(key);

  // Build distance-sorted index list (only untaken ports)
  const indices = [];
  for (let i = 0; i < ports.length; i++) {
    if (taken.has(i)) continue;
    const p = ports[i];
    const dx = (node.x + p.x) - targetX;
    const dy = (node.y + p.y) - targetY;
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
      const dx = (node.x + p.x) - targetX;
      const dy = (node.y + p.y) - targetY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
  } else {
    taken.add(bestIdx);
  }

  const p = ports[bestIdx];
  return { x: node.x + p.x, y: node.y + p.y };
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

// ── Cross-panel routing helpers ─────────────────────────────────────────
const FED_PANEL_RIGHT = 520;
const CORRIDOR_X = 530;

function isFedNode(id) {
  const n = nodeMap[id];
  return n && n.x < FED_PANEL_RIGHT;
}

/**
 * Build edge path with obstacle-aware routing:
 * - Cross-panel (Fed ↔ Market): orthogonal L-shaped via corridor (unchanged)
 * - Intra-panel straight: when line-of-sight is clear
 * - Intra-panel polyline: when straight line crosses intermediate shapes (max 2 turns)
 * Stores _labelPos for efficient label placement.
 */
function edgePath(edge) {
  const srcInfo = resolveEndpoint(edge.source);
  const tgtInfo = resolveEndpoint(edge.target);
  if (!srcInfo || !tgtInfo) { edge._labelPos = { x: 0, y: 0 }; return ""; }

  const srcIsSec = edge.source.startsWith("sec:");
  const tgtIsSec = edge.target.startsWith("sec:");
  const tgtCX = tgtInfo.x, tgtCY = tgtInfo.y;
  const srcCX = srcInfo.x, srcCY = srcInfo.y;

  // Initial port / section-edge-point allocation
  let sp, tp;
  if (srcIsSec && srcInfo.rect) {
    sp = sectionEdgePoint(srcInfo.rect, tgtCX, tgtCY);
  } else {
    sp = allocatePort(edge.source, tgtCX, tgtCY, "out");
  }
  if (tgtIsSec && tgtInfo.rect) {
    tp = sectionEdgePoint(tgtInfo.rect, srcCX, srcCY);
  } else {
    tp = allocatePort(edge.target, srcCX, srcCY, "in");
  }

  const s = srcIsSec ? { x: sp.x, y: sp.y } : nodeMap[edge.source];
  const t = tgtIsSec ? { x: tp.x, y: tp.y } : nodeMap[edge.target];
  if (!s || !t) { edge._labelPos = { x: 0, y: 0 }; return ""; }

  const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
  const step = Math.min(OFFSET_PX, Math.max(4, 60 / total));
  const offset = (index - (total - 1) / 2) * step;

  const srcFed = !srcIsSec && isFedNode(edge.source);
  const tgtFed = !tgtIsSec && isFedNode(edge.target);

  // ── Cross-panel routing (Fed ↔ Market) — keep existing corridor logic ──
  if (srcFed !== tgtFed) {
    const finalSp = srcFed
      ? allocatePort(edge.source, s.x + 2000, s.y, "out")
      : (srcIsSec ? sp : allocatePort(edge.source, s.x - 2000, s.y, "out"));
    const finalTp = tgtFed
      ? allocatePort(edge.target, t.x + 2000, t.y, "in")
      : (tgtIsSec ? tp : allocatePort(edge.target, t.x - 2000, t.y, "in"));

    const dy = Math.abs(finalTp.y - finalSp.y);
    if (dy >= 300) {
      const cx = CORRIDOR_X + offset;
      edge._labelPos = { x: cx + 10, y: (finalSp.y + finalTp.y) / 2 };
      return `M ${finalSp.x},${finalSp.y} L ${cx},${finalSp.y} L ${cx},${finalTp.y} L ${finalTp.x},${finalTp.y}`;
    }
    edge._labelPos = { x: (finalSp.x + finalTp.x) / 2, y: (finalSp.y + finalTp.y) / 2 + offset - 5 };
    return `M ${finalSp.x},${finalSp.y + offset} L ${finalTp.x},${finalTp.y + offset}`;
  }

  // ── Intra-panel routing with obstacle detection ─────────────────────
  // Apply consistent perpendicular offset for bidirectional edges
  const [refS, refT] = edge.source < edge.target ? [s, t] : [t, s];
  const rdx = refT.x - refS.x, rdy = refT.y - refS.y;
  const rlen = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
  const ox = (-rdy / rlen) * offset, oy = (rdx / rlen) * offset;

  const startX = sp.x + ox, startY = sp.y + oy;
  const endX = tp.x + ox, endY = tp.y + oy;

  // Collect node IDs to exclude from collision (source, target, and section anchors)
  const excludeIds = new Set();
  if (!srcIsSec) excludeIds.add(edge.source);
  if (!tgtIsSec) excludeIds.add(edge.target);

  // Only allow straight line when axis-aligned (same x ±2 or same y ±2) and ≥5px apart
  const ALIGN_TOL = 2, MIN_EDGE_LEN = 5;
  const axisAligned = Math.abs(startX - endX) < ALIGN_TOL || Math.abs(startY - endY) < ALIGN_TOL;
  const edgeLen = Math.abs(startX - endX) + Math.abs(startY - endY);

  if (axisAligned && edgeLen >= MIN_EDGE_LEN &&
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

  // Build SVG path from waypoints
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
  return d;
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
    const midY = sy + dy * frac;
    zCandidates.push([
      { x: sx, y: sy }, { x: sx, y: midY }, { x: ex, y: midY }, { x: ex, y: ey }
    ]);
    // V-H-V
    const midX = sx + dx * frac;
    zCandidates.push([
      { x: sx, y: sy }, { x: midX, y: sy }, { x: midX, y: ey }, { x: ex, y: ey }
    ]);
  }

  // Side jogs with extended range
  const sideJogs = [40, -40, 80, -80, 120, -120, 160, -160];
  for (const jog of sideJogs) {
    const midY = (sy + ey) / 2 + jog;
    zCandidates.push([
      { x: sx, y: sy }, { x: sx, y: midY }, { x: ex, y: midY }, { x: ex, y: ey }
    ]);
    const midX = (sx + ex) / 2 + jog;
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
  const mx = (sx + ex) / 2;
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
  const my = (sy + ey) / 2;
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
    for (const sid of d.seriesIds) {
      const v = values?.[sid];
      if (v != null) {
        const units = metadata?.[sid]?.units ?? "";
        display = formatValue(v, units);
        break;
      }
    }
    if (!display && d.seriesIds.length > 0) display = "N/A";

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
