/**
 * v2/badges.js — proxy-value badges overlaid on top of v1-rendered nodes.
 *
 * Module C deliverable: each node gets a small SVG badge anchored at
 * its top-right corner showing the latest value of its primary FRED
 * proxy. Nodes lacking a proxy (or with non-FRED proxies whose values
 * are not yet wired to the data layer) display:
 *   - "n/a" (grey)         when proxy_status === "not_found"
 *   - "ⓘ" with a hover tag when proxy_status ∈ {"partial","external"}
 *
 * The overlay is purely additive — the v1 renderer is untouched, so
 * §0.1.2 (v2 visual baseline = v1) remains intact for nodes without a
 * registered proxy. Only nodes WITH proxy data show a v2-only badge.
 */

import { SHAPE_SIZES } from "../config.js";

const NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function nodeHalfExtent(node) {
  const dim = SHAPE_SIZES[node.shape];
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

function badgeContent(node, dataLoader) {
  const proxy = node.proxy;
  if (!proxy) return null;
  if (proxy.proxy_status === "not_found") {
    return { text: "n/a", kind: "muted" };
  }
  const primary = proxy.primary;
  if (!primary) {
    return { text: "—", kind: "muted" };
  }
  if (primary.source === "FRED") {
    const hit = latestSeriesValue(dataLoader, primary.series);
    if (hit) {
      const meta  = dataLoader?.metadata?.[primary.series] ?? {};
      const units = meta.units ?? primary.unit ?? "";
      const fv    = dataLoader?.formatValue?.(hit.value, units) ?? String(hit.value);
      const kind  = proxy.proxy_status && proxy.proxy_status !== "ok" ? "info" : "value";
      return { text: fv, kind, info: proxy.proxy_status };
    }
  }
  // Non-FRED or FRED-without-cached-value → show source tag with info marker
  if (proxy.proxy_status === "external" || proxy.proxy_status === "partial") {
    return { text: "ⓘ", kind: "info", info: proxy.proxy_status };
  }
  return { text: primary.source, kind: "muted" };
}

/**
 * Render proxy-value badges into `layer` for each node in `nodes`.
 * @param {SVGGElement|d3.Selection} layer
 * @param {Array<object>}            nodes      v2 NODES (decorated with proxy)
 * @param {object}                   dataLoader v1 DataLoader instance
 */
export function renderProxyBadges(layer, nodes, dataLoader) {
  const root = layer?.node ? layer.node() : layer;
  if (!root) return;
  while (root.firstChild) root.removeChild(root.firstChild);

  for (const n of nodes) {
    const content = badgeContent(n, dataLoader);
    if (!content) continue;

    const { hw, hh } = nodeHalfExtent(n);
    // Anchor: top-right corner of node bounding box, slight outward offset.
    const cx = n.x + hw - 6;
    const cy = n.y - hh + 4;

    const g = svg("g", {
      class: `proxy-badge proxy-badge-${content.kind}`,
      "data-node-id": n.id,
      transform: `translate(${cx}, ${cy})`,
    });

    const padX = 6;
    const fontSize = 11;
    const charW = fontSize * 0.55;
    const w = Math.max(20, content.text.length * charW + padX * 2);
    const h = 16;

    g.appendChild(svg("rect", {
      x: -w, y: -h / 2, width: w, height: h, rx: 8, ry: 8,
      class: "proxy-badge-bg",
    }));
    const text = svg("text", {
      x: -w / 2, y: 0,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      class: "proxy-badge-text",
    });
    text.textContent = content.text;
    g.appendChild(text);

    if (content.info) {
      const t = svg("title");
      t.textContent =
        content.info === "external" ? "external — out-of-band data source" :
        content.info === "partial"  ? "partial — manual download required" :
        content.info === "not_found" ? "no public proxy" : content.info;
      g.appendChild(t);
    }

    root.appendChild(g);
  }
}
