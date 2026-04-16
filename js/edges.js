/**
 * edges.js — D3 rendering of directed funding flow edges.
 * Orthogonal (polyline / L-shaped) routing with port-based connection points.
 * Each node shape exposes multiple ports; the router assigns a unique port per edge,
 * guaranteeing that each connection point is used by at most one edge.
 */
import { EDGES, NODES, EDGE_COLORS, SHAPE_PORTS, SHAPE_SIZES } from "./constants.js";
import { isSelecting } from "./tooltip.js";

const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

// ── Port allocation: one port per edge, per node side ─────────────────────
// Tracks which local-port index has been assigned for each (nodeId, direction).
// direction = "out" for source, "in" for target.
const usedPorts = new Map(); // key: `${nodeId}_${dir}` → Set of port indices

/**
 * Pick the best available port on *node* facing toward *target*.
 * Prefers the port whose angle most closely aligns with the direction to target.
 * Guarantees no two edges share the same (node, dir) port index.
 */
function allocatePort(nodeId, targetX, targetY, dir) {
  const node = nodeMap[nodeId];
  if (!node) return { x: node?.x ?? 0, y: node?.y ?? 0 };

  const ports = SHAPE_PORTS[node.shape];
  if (!ports || ports.length === 0) return { x: node.x, y: node.y };

  const key = `${nodeId}_${dir}`;
  if (!usedPorts.has(key)) usedPorts.set(key, new Set());
  const taken = usedPorts.get(key);

  // Direction vector from node center to target
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const rawAngle = Math.atan2(dy, dx);

  // Score each available port by angular alignment; pick the best.
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < ports.length; i++) {
    if (taken.has(i)) continue;
    const p = ports[i];
    let diff = Math.abs(normalizeAngle(p.angle - rawAngle));
    // Wrap-around: prefer smaller diff even across ±π boundary
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  // Fallback: if all ports are taken, reuse the least-bad one
  if (bestIdx === -1) {
    bestIdx = 0;
    for (let i = 0; i < ports.length; i++) {
      const p = ports[i];
      let diff = Math.abs(normalizeAngle(p.angle - rawAngle));
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
  } else {
    taken.add(bestIdx);
  }

  const p = ports[bestIdx];
  return { x: node.x + p.x, y: node.y + p.y };
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ── Parallel-edge offset grouping ────────────────────────────────────────
// Edges sharing the same ordered pair get an L-offset so they don't overlap.
function computeOffsets() {
  const groups = {};
  EDGES.forEach(e => {
    const key = `${e.source}|${e.target}`;
    (groups[key] ??= []).push(e.id);
  });
  const offsets = {};
  for (const ids of Object.values(groups)) {
    ids.forEach((id, i) => {
      offsets[id] = { index: i, total: ids.length };
    });
  }
  return offsets;
}

const OFFSETS = computeOffsets();
const OFFSET_PX = 16;

/** Build a clean edge path: straight line with optional gentle curve for long-range flows. */
function edgePath(edge) {
  const s = nodeMap[edge.source];
  const t = nodeMap[edge.target];
  if (!s || !t) return "";

  // Allocate unique ports
  const sp = allocatePort(edge.source, t.x, t.y, "out");
  const tp = allocatePort(edge.target, s.x, s.y, "in");

  // Parallel offset for edges sharing the same (source, target)
  const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
  const offset = (index - (total - 1) / 2) * OFFSET_PX;

  // Direction vectors
  const dx = tp.x - sp.x;
  const dy = tp.y - sp.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular offset vector for parallel edge separation
  const ox = (-dy / len) * offset;
  const oy = (dx / len) * offset;

  const startX = sp.x + ox;
  const startY = sp.y + oy;
  const endX = tp.x + ox;
  const endY = tp.y + oy;

  // Determine if we need a curved path vs straight line
  // Use curve when: crossing large distance vertically AND horizontally,
  // or source/target are on opposite sides (would create awkward angle)
  const needsCurve = shouldUseCurve(s, t, sp, tp);

  if (!needsCurve) {
    // Clean straight line (matching the reference diagram style)
    return `M ${startX},${startY} L ${endX},${endY}`;
  }

  // Gentle quadratic bezier curve — much smoother than orthogonal elbow
  // Control point placed along dominant axis to create natural arc
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  let ctrlX, ctrlY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Mostly horizontal → bulge horizontally
    ctrlX = midX;
    ctrlY = Math.abs(dy) > 200 ? startY + dy * 0.3 : midY;
  } else {
    // Mostly vertical → bulge vertically
    ctrlY = midY;
    ctrlX = Math.abs(dx) > 200 ? startX + dx * 0.3 : midX;
  }

  return `M ${startX},${startY} Q ${ctrlX},${ctrlY} ${endX},${endY}`;
}

/**
 * Determine whether an edge should use curved routing.
 * Curves are used for long-distance cross-panel flows that would otherwise
 * cut awkwardly through intermediate content areas.
 */
function shouldUseCurve(sourceNode, targetNode, sp, tp) {
  const dx = Math.abs(tp.x - sp.x);
  const dy = Math.abs(tp.y - sp.y);

  // Always use straight line for short distances
  if (dx < 300 && dy < 150) return false;

  // Use curve for very long vertical spans (Fed→bottom entities)
  if (dy > 500 && dx > 400) return true;

  // Use curve for cross-panel flows that span multiple sections
  const srcGroup = sourceNode.group || "";
  const tgtGroup = targetNode.group || "";
  const crossPanel =
    (srcGroup === "bs_assets" || srcGroup === "bs_liabilities") &&
    (tgtGroup.startsWith("onshore") || tgtGroup.startsWith("offshore") || tgtGroup === "gov_entities");

  if (crossPanel && dy > 600) return true;

  // Default: straight line (matching reference image style)
  return false;
}

/** Label position at the middle of the edge path. */
function labelPos(edge) {
  const s = nodeMap[edge.source];
  const t = nodeMap[edge.target];
  if (!s || !t) return { x: 0, y: 0 };

  const sp = allocatePort(edge.source, t.x, t.y, "out");
  const tp = allocatePort(edge.target, s.x, s.y, "in");

  const { index, total } = OFFSETS[edge.id] || { index: 0, total: 1 };
  const offset = (index - (total - 1) / 2) * OFFSET_PX;

  const dx = tp.x - sp.x;
  const dy = tp.y - sp.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = (-dy / len) * offset;
  const oy = (dx / len) * offset;

  // Place label at path midpoint with slight offset for readability
  const midX = (sp.x + tp.x) / 2 + ox;
  const midY = (sp.y + tp.y) / 2 + oy - 5;

  return { x: midX, y: midY };
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

  const g = layer.selectAll("g.edge")
    .data(EDGES, d => d.id)
    .join("g")
      .attr("class", "edge");

  // Path — orthogonal polyline
  g.append("path")
    .attr("d", edgePath)
    .attr("fill", "none")
    .attr("stroke", edgeColor)
    .attr("stroke-width", 1.6)
    .attr("stroke-linejoin", "miter")
    .attr("marker-end", d => `url(#arrow-${d.color})`);

  // Value label background
  g.append("rect")
    .attr("class", "edge-label-bg")
    .attr("rx", 3).attr("ry", 3)
    .attr("fill", "#fff")
    .attr("opacity", 0.88)
    .attr("visibility", "hidden");

  // Hover target (invisible wider path for easy hovering)
  // MUST be rendered BEFORE the text label so that text sits on top and receives mouse events
  g.append("path")
    .attr("class", "edge-hover-zone")
    .attr("d", edgePath)
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
