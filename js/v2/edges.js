/**
 * v2/edges.js — render edges using the routing primitives from
 * `layout/routing.js`. Modules C/D/E flesh out edge data and styling.
 *
 * Edge spec (minimum): { id, source, target, kind?, color?, label? }
 *   kind: "manhattan" | "bezier" | undefined (auto via pickRouter)
 *
 * Module E (S4) extension:
 *   Edges may carry a `style` object: { color, dash, arrow } and a
 *   `label` string. The renderer respects these for stroke colour,
 *   stroke-dasharray and an inline midpoint label. Anchor calculation
 *   accounts for v1 nodes whose `(x, y)` is the *center* of the shape
 *   — we synthesize a top-left+size box for the routing primitives.
 */

import { pickRouter, routeManhattan, routeBezier, applyBundleOffset } from "./layout/routing.js";
import { SHAPE_SIZES } from "../config.js";

const NS = "http://www.w3.org/2000/svg";

function svg(tag) {
  return document.createElementNS(NS, tag);
}

/**
 * v1 NODES use `(x, y)` as the *center* of the rendered shape. The
 * routing helpers in `layout/routing.js` expect `(x, y)` to be the
 * top-left and `width / height` to describe the bounding box. Convert
 * once here so callers don't need to care.
 */
function toBox(node) {
  if (!node) return null;
  // Section objects already have (x, y) as top-left + (w, h).
  if (typeof node.w === "number" && typeof node.h === "number") {
    return { ...node, width: node.w, height: node.h };
  }
  const sz = SHAPE_SIZES[node.shape];
  if (!sz) return { ...node, width: 0, height: 0 };
  const width  = "rx" in sz ? sz.rx * 2 : sz.width;
  const height = "ry" in sz ? sz.ry * 2 : sz.height;
  return {
    ...node,
    x: node.x - width  / 2,
    y: node.y - height / 2,
    width,
    height,
  };
}

function selectRouter(kind, s, t) {
  if (kind === "manhattan") return routeManhattan;
  if (kind === "bezier") return routeBezier;
  return pickRouter(s, t);
}

/**
 * @param {SVGGElement} layer  parent <g>
 * @param {Array<object>} edges
 * @param {Array<object>} nodes
 */
export function renderEdges(layer, edges, nodes) {
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  if (!edges?.length) return;

  const idx = Object.fromEntries(nodes.map(n => [n.id, n]));

  // Annotate edges with target panel so bundling can group them.
  for (const e of edges) {
    e.target_panel = idx[e.target]?.panel ?? idx[e.target]?.group;
  }
  applyBundleOffset(edges);

  for (const e of edges) {
    const sNode = idx[e.source];
    const tNode = idx[e.target];
    if (!sNode || !tNode) {
      console.warn(`[v2/edges] missing node for edge ${e.id}`, { source: e.source, target: e.target });
      continue;
    }
    const s = toBox(sNode);
    const t = toBox(tNode);

    const router = selectRouter(e.kind, s, t);
    const offset = e._bundleOffset ?? 0;
    const d = router(s, t, { offset });

    const g = svg("g");
    g.setAttribute("class", `edge edge-${e.kind ?? "auto"}`);
    g.setAttribute("data-edge-id", e.id);
    if (e.transaction_type) {
      g.setAttribute("data-transaction-type", e.transaction_type);
    }

    const path = svg("path");
    path.setAttribute("class", "edge-stroke");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");

    const stroke = e.style?.color ?? e.color ?? "#666";
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", "1.6");
    path.setAttribute("stroke-linejoin", "round");
    if (e.style?.dash) path.setAttribute("stroke-dasharray", e.style.dash);
    g.appendChild(path);

    if (e.label) {
      // Place label near the path midpoint via SVG text along path -
      // simple approach: use textPath only when a unique path id exists.
      const pid = `edge-path-${e.id}`;
      path.setAttribute("id", pid);

      const text = svg("text");
      text.setAttribute("class", "edge-label");
      text.setAttribute("font-size", "11");
      text.setAttribute("fill", stroke);
      text.setAttribute("dy", "-3");

      const tp = svg("textPath");
      tp.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${pid}`);
      tp.setAttribute("href", `#${pid}`);
      tp.setAttribute("startOffset", "50%");
      tp.setAttribute("text-anchor", "middle");
      tp.textContent = e.label;
      text.appendChild(tp);
      g.appendChild(text);
    }

    layer.appendChild(g);
  }
}

