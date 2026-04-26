/**
 * v2/diagram.js — coordinator for the v2 diagram.
 *
 * S2 baseline: render the same sections + nodes as v1 by delegating
 * to v1's renderers. Edges remain empty until Modules C/D/E populate
 * EDGES.
 *
 * Module C (S3) addition: adds an additive `badge-layer` above nodes
 * that displays proxy values, plus tooltip wiring on node hover. Both
 * are pure overlays — v1's renderNodes is still in charge of node
 * geometry/colors, so §0.1.2 (visual baseline = v1) holds for nodes
 * without a proxy.
 *
 * d3 is loaded globally from the CDN <script> tag in index.html.
 */

import { renderSections } from "../nodes.js";
import { defineMarkers } from "../edges.js";
import { renderNodes } from "./nodes.js";
import { renderEdges } from "./edges.js";
import { renderProxyBadges } from "./badges.js";
import { initTooltip, showNodeProxy, hideTooltip } from "./tooltip.js";
import { NODES, EDGES, NODE_PROXIES } from "./constants.js";

/**
 * @param {SVGSVGElement} svgEl
 * @param {object}        dataLoader  v1 DataLoader (shared instance)
 */
export function initDiagram(svgEl, dataLoader) {
  const sel = window.d3?.select(svgEl);
  if (!sel) {
    console.error("[v2] d3 not available — ensure d3.v7 script is loaded");
    return;
  }

  // Idempotent: clear any prior render.
  sel.selectAll("*").remove();

  const root         = sel.append("g").attr("class", "v2-root");
  const defs         = root.append("defs");
  const sectionLayer = root.append("g").attr("class", "section-layer");
  const edgeLayer    = root.append("g").attr("class", "edge-layer");
  const nodeLayer    = root.append("g").attr("class", "node-layer");
  const badgeLayer   = root.append("g").attr("class", "badge-layer");

  defineMarkers(defs);
  renderSections(sectionLayer);
  renderEdges(edgeLayer.node(), EDGES, NODES);   // no-op while EDGES = []
  renderNodes(nodeLayer, {
    onNodeHover: (d, event) => showNodeProxy(d, event, dataLoader, NODE_PROXIES),
    onNodeOut:   () => hideTooltip(),
  });
  renderProxyBadges(badgeLayer, NODES, dataLoader);

  initTooltip();
}
