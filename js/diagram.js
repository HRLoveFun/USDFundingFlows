/**
 * diagram.js — SVG orchestrator.
 * Layered rendering: defs → sections → edges → nodes → labels.
 * Exports updateValues() and highlightTransactionType().
 */
import { WIDTH, HEIGHT, EDGES, NODES } from "./constants.js";
import { renderSections, renderNodes, updateNodeBadges } from "./nodes.js";
import { renderEdges, updateEdgeLabels, defineMarkers } from "./edges.js";

let svg, edgeGroup, nodeGroup, zoomG;
let cachedEdgeSel, cachedNodeSel;

export function render(container, { onNodeHover, onNodeOut, onEdgeHover, onEdgeOut }) {
  svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  // Zoom/pan group
  zoomG = svg.append("g").attr("class", "zoom-layer");

  // Enable zoom/pan
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", (event) => zoomG.attr("transform", event.transform));
  svg.call(zoom);

  // Layers (render order: sections → edges → nodes)
  const defs = zoomG.append("defs");
  defineMarkers(defs);

  const sectionLayer = zoomG.append("g").attr("class", "section-layer");
  const edgeLayer    = zoomG.append("g").attr("class", "edge-layer");
  const nodeLayer    = zoomG.append("g").attr("class", "node-layer");

  // Render sections (backgrounds, headers, annotations)
  renderSections(sectionLayer);

  edgeGroup = renderEdges(edgeLayer, { onEdgeHover, onEdgeOut });
  nodeGroup = renderNodes(nodeLayer, { onNodeHover, onNodeOut });

  cachedEdgeSel = svg.selectAll("g.edge");
  cachedNodeSel = svg.selectAll("g.node");
}

/**
 * Update all edge value labels and node badges for the given date.
 */
export function updateValues(date, dataLoader) {
  const values   = dataLoader.getValuesForDate(date);
  const metadata = dataLoader.metadata;
  const fmt      = dataLoader.formatValue;

  updateEdgeLabels(edgeGroup, values, metadata, fmt);
  updateNodeBadges(nodeGroup, values, fmt);
}

/**
 * Highlight only edges of the given arrow color type; dim everything else.
 * Pass null to reset.
 */
export function highlightTransactionType(typeId) {
  if (!typeId) {
    resetHighlight();
    return;
  }

  const matchedEdgeIds = new Set();
  const matchedNodeIds = new Set();

  EDGES.forEach(e => {
    if (e.color === typeId) {
      matchedEdgeIds.add(e.id);
      matchedNodeIds.add(e.source);
      matchedNodeIds.add(e.target);
    }
  });

  cachedEdgeSel.classed("dimmed", d => !matchedEdgeIds.has(d.id));
  cachedNodeSel.classed("dimmed", d => !matchedNodeIds.has(d.id));
}

/**
 * Reset all highlighting.
 */
export function resetHighlight() {
  cachedEdgeSel.classed("dimmed", false);
  cachedNodeSel.classed("dimmed", false);
}
