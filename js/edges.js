/**
 * edges.js — D3 rendering of directed funding flow edges.
 * Quadratic Bézier curves with perpendicular offsets for parallel edges,
 * SVG marker arrows, and value labels.
 */
import { EDGES, NODES, EDGE_COLORS } from "./constants.js";

const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

/**
 * Precompute offset indices for edges sharing the same node pair.
 * Groups by sorted(source, target) so A→B and B→A are counted together.
 */
function computeOffsets() {
  const groups = {};
  EDGES.forEach(e => {
    const key = [e.source, e.target].sort().join("|");
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
const OFFSET_PX = 22;  // slightly tighter for more edges

/** Compute quadratic Bézier path string with perpendicular offset. */
function edgePath(edge) {
  const s = nodeMap[edge.source];
  const t = nodeMap[edge.target];
  const { index, total } = OFFSETS[edge.id];
  const offset = (index - (total - 1) / 2) * OFFSET_PX;

  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular unit vector
  const px = -dy / len;
  const py =  dx / len;

  const cx = mx + px * offset;
  const cy = my + py * offset;
  return `M ${s.x},${s.y} Q ${cx},${cy} ${t.x},${t.y}`;
}

/** Label position: midpoint of the Bézier at t=0.5. */
function labelPos(edge) {
  const s = nodeMap[edge.source];
  const t = nodeMap[edge.target];
  const { index, total } = OFFSETS[edge.id];
  const offset = (index - (total - 1) / 2) * OFFSET_PX;

  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  const cx = mx + (-dy / len) * offset;
  const cy = my + ( dx / len) * offset;
  return {
    x: 0.25 * s.x + 0.5 * cx + 0.25 * t.x,
    y: 0.25 * s.y + 0.5 * cy + 0.25 * t.y,
  };
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
      .attr("refX", 10)
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
  const g = layer.selectAll("g.edge")
    .data(EDGES, d => d.id)
    .join("g")
      .attr("class", "edge");

  // Path
  g.append("path")
    .attr("d", edgePath)
    .attr("fill", "none")
    .attr("stroke", edgeColor)
    .attr("stroke-width", 1.8)
    .attr("marker-end", d => `url(#arrow-${d.color})`);

  // Value label background
  g.append("rect")
    .attr("class", "edge-label-bg")
    .attr("rx", 3).attr("ry", 3)
    .attr("fill", "#fff")
    .attr("opacity", 0.85)
    .attr("visibility", "hidden");

  // Value label
  g.append("text")
    .attr("class", "edge-label")
    .attr("text-anchor", "middle")
    .attr("font-size", "9px")
    .attr("fill", "#333")
    .each(function (d) {
      const pos = labelPos(d);
      d3.select(this).attr("x", pos.x).attr("y", pos.y - 4);
    });

  // Hover target (invisible wider path for easy hovering)
  g.append("path")
    .attr("d", edgePath)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 12)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => onEdgeHover?.(d, event))
    .on("mouseleave", (event, d) => onEdgeOut?.(d));

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

    // Pick the first series that has data
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

    // Size background rect to fit text
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
