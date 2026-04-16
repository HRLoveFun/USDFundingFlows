/**
 * nodes.js — D3 rendering of entity nodes with multiple shapes.
 * Shapes: hexagon (banks), pentagon (dealers), circle (investors),
 *         rectangle (Treasury), bs_parent/bs_child (balance sheet items).
 */
import { NODES, EDGES, SHAPE_COLORS, SHAPE_SIZES, SECTIONS, ANNOTATIONS, SHAPE_PORTS } from "./constants.js";
import { isSelecting } from "./tooltip.js";

// ── Auto-wrap text helper ──────────────────────────────────────────────
// Estimate average char width (px) per font-size for balance sheet nodes.
const CHAR_WIDTH_MAP = { 9: 5.2, 8: 4.6 };

function autoWrapText(label, fontSize, maxWidth) {
  const cw = CHAR_WIDTH_MAP[fontSize] || 5;
  // Rough estimate: max characters per line
  const maxChars = Math.floor(maxWidth / cw);
  if (label.length <= maxChars) return [label];

  const words = label.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (trial.length <= maxChars) {
      current = trial;
    } else {
      if (current) lines.push(current);
      // If a single word exceeds maxChars, force-break it
      current = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}

// ── Shape generators ────────────────────────────────────────────────────

function hexagonPoints(rx, ry) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${rx * Math.cos(a)},${ry * Math.sin(a)}`);
  }
  return pts.join(" ");
}

// ── Section / group background rendering ────────────────────────────────

export function renderSections(layer) {
  // Render each section as a background rectangle
  const sectionOrder = ["fed", "bs", "market", "onshore", "offshore",
    "banks_dealers", "dash_banks_pair", "onshore_inv", "dash_mmf_row",
    "dash_investor_group", "gov_entities", "dash_gse_pair",
    "institutional_investors", "offshore_investors"];

  const ordered = sectionOrder
    .map(id => SECTIONS.find(s => s.id === id))
    .filter(Boolean);

  const g = layer.selectAll("g.section")
    .data(ordered, d => d.id)
    .join("g")
      .attr("class", d => `section section-${d.style}`);

  g.append("rect")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("width", d => d.w)
    .attr("height", d => d.h)
    .attr("rx", d => (d.style === "dashed" || d.style === "dashed_gray") ? 0 : 6)
    .attr("fill", d => {
      if (d.style === "header") return "#f5f5f5";
      if (d.style === "subheader") return "#fafafa";
      if (d.style === "dashed" || d.style === "dashed_gray") return "none";
      return "#ffffff";
    })
    .attr("stroke", d => {
      if (d.style === "header") return "#bdbdbd";
      if (d.style === "dashed") return "#9C27B0";
      if (d.style === "dashed_gray") return "#9e9e9e";
      return "#e0e0e0";
    })
    .attr("stroke-width", d => (d.style === "dashed" || d.style === "dashed_gray") ? 1.5 : 1)
    .attr("stroke-dasharray", d => (d.style === "dashed" || d.style === "dashed_gray") ? "6,4" : "");

  // Section headers — L1 (header) / L2 (subheader) / L3 (group)
  g.each(function (d) {
    if (!d.label) return;
    const sel = d3.select(this);
    if (d.style === "header") {
      // L1: Dark gray bar with white text
      sel.append("rect")
        .classed("header-bar", true)
        .attr("x", d.x).attr("y", d.y)
        .attr("width", d.w).attr("height", 32)
        .attr("rx", 6)
        .attr("fill", "#424242");
      sel.append("text")
        .classed("header-title", true)
        .attr("x", d.x + d.w / 2)
        .attr("y", d.y + 21)
        .text(d.label);
    } else if (d.style === "subheader") {
      // L2: Sub-panel title
      sel.append("text")
        .classed("subheader-text", true)
        .attr("x", d.x + d.w / 2)
        .attr("y", d.y + 18)
        .text(d.label);
    } else if (d.style === "group") {
      // L3: Group container label
      sel.append("text")
        .classed("group-label-text", true)
        .attr("x", d.x + d.w / 2)
        .attr("y", d.y + 16)
        .text(d.label);
    }
  });

  // Annotations — typography controlled by CSS: text.annotation
  const ann = layer.selectAll("text.annotation")
    .data(ANNOTATIONS)
    .join("text")
      .attr("class", "annotation")
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("text-anchor", "middle")
      .text(d => d.text);
}

// ── Node rendering ──────────────────────────────────────────────────────

export function renderNodes(layer, { onNodeHover, onNodeOut }) {
  const g = layer.selectAll("g.node")
    .data(NODES, d => d.id)
    .join("g")
      .attr("class", d => `node node-${d.shape}`)
      .attr("transform", d => `translate(${d.x},${d.y})`);

  // Draw shape per type — bind hover events directly on shapes (not text)
  g.each(function (d) {
    const sel = d3.select(this);
    const fill = SHAPE_COLORS[d.shape];
    const sz = SHAPE_SIZES[d.shape];

    switch (d.shape) {
      case "hexagon": {
        sel.append("polygon")
          .attr("class", "node-shape")
          .attr("points", hexagonPoints(sz.rx, sz.ry))
          .attr("fill", "none")
          .attr("stroke", "#424242")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92)
          .on("mouseenter", function (event) {
            if (!isSelecting()) { onNodeHover?.(d, event); highlightConnected(layer.node().parentNode, d.id); }
          })
          .on("mouseleave", function () { onNodeOut?.(d); resetHighlightAll(layer.node().parentNode); });
        break;
      }
      case "circle": {
        sel.append("ellipse")
          .attr("class", "node-shape")
          .attr("cx", 0).attr("cy", 0)
          .attr("rx", sz.rx)
          .attr("ry", sz.ry)
          .attr("fill", "none")
          .attr("stroke", "#424242")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92)
          .on("mouseenter", function (event) {
            if (!isSelecting()) { onNodeHover?.(d, event); highlightConnected(layer.node().parentNode, d.id); }
          })
          .on("mouseleave", function () { onNodeOut?.(d); resetHighlightAll(layer.node().parentNode); });
        break;
      }
      case "rectangle": {
        sel.append("rect")
          .attr("class", "node-shape")
          .attr("x", -sz.width / 2).attr("y", -sz.height / 2)
          .attr("width", sz.width).attr("height", sz.height)
          .attr("rx", 6)
          .attr("fill", "none")
          .attr("stroke", "#424242")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92)
          .on("mouseenter", function (event) {
            if (!isSelecting()) { onNodeHover?.(d, event); highlightConnected(layer.node().parentNode, d.id); }
          })
          .on("mouseleave", function () { onNodeOut?.(d); resetHighlightAll(layer.node().parentNode); });
        break;
      }
      case "bs_parent": {
        sel.append("rect")
          .attr("class", "node-shape")
          .attr("x", -sz.width / 2).attr("y", -sz.height / 2)
          .attr("width", sz.width).attr("height", sz.height)
          .attr("rx", 4)
          .attr("fill", "none")
          .attr("stroke", "#90CAF9")
          .attr("stroke-width", 1.0)
          .on("mouseenter", function (event) {
            if (!isSelecting()) { onNodeHover?.(d, event); highlightConnected(layer.node().parentNode, d.id); }
          })
          .on("mouseleave", function () { onNodeOut?.(d); resetHighlightAll(layer.node().parentNode); });
        break;
      }
      case "bs_child": {
        sel.append("rect")
          .attr("class", "node-shape")
          .attr("x", -sz.width / 2).attr("y", -sz.height / 2)
          .attr("width", sz.width).attr("height", sz.height)
          .attr("rx", 3)
          .attr("fill", "none")
          .attr("stroke", "#FFE082")
          .attr("stroke-width", 0.7)
          .on("mouseenter", function (event) {
            if (!isSelecting()) { onNodeHover?.(d, event); highlightConnected(layer.node().parentNode, d.id); }
          })
          .on("mouseleave", function () { onNodeOut?.(d); resetHighlightAll(layer.node().parentNode); });
        break;
      }
    }
  });

  // ── Connection port markers (small dots on shape perimeter) ───────────
  g.each(function (d) {
    const sel = d3.select(this);
    const ports = SHAPE_PORTS[d.shape];
    if (!ports) return;

    // Port markers — nearly transparent, only visible on hover for debugging
    const dotColor = "transparent";
    const dotRadius = d.shape === "bs_child" ? 1.5 : 2;

    ports.forEach(p => {
      sel.append("circle")
        .attr("class", "port-marker")
        .attr("cx", p.x)
        .attr("cy", p.y)
        .attr("r", dotRadius)
        .attr("fill", dotColor)
        .attr("stroke", "none")
        .attr("pointer-events", "none");
    });
  });

  // Multi-line label
  g.each(function (d) {
    const sel = d3.select(this);
    const isBsParent = d.shape === "bs_parent";
    const isBsChild  = d.shape === "bs_child";
    const isBs       = isBsParent || isBsChild;

    // Auto-wrap text for balance sheet nodes
    let lines;
    if (isBs) {
      const sz = SHAPE_SIZES[d.shape];
      lines = autoWrapText(d.label, isBsChild ? 8 : 9, sz.width - 12);
      // Dynamically resize rect height to fit wrapped text
      if (lines.length > 1) {
        const lineHeight = isBsChild ? 10 : 11;
        const newH = Math.max(sz.height, 14 + (lines.length - 1) * lineHeight);
        sel.select("rect")
          .attr("height", newH)
          // Re-center vertically: keep top edge at original y, shift down half the diff
          .attr("y", -newH / 2);
      }
    } else {
      lines = d.label.split("\n");
    }

    const text = sel.append("text")
      .classed("node-label", true)
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#1A237E")
      /* L5a/L5b/L5c sizes controlled by diagram.css via shape class */
      .attr("font-size", isBsChild ? "8px" : (isBs ? "9px" : "10px"))
      .attr("font-weight", isBsChild ? 400 : (isBs ? 500 : 600))
      .attr("pointer-events", "auto");

    const lineHeight = isBsChild ? 10 : (isBs ? 11 : 13);
    const startY = -(lines.length - 1) * lineHeight / 2;

    lines.forEach((line, i) => {
      text.append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? startY : lineHeight)
        .text(line);
    });
  });

  // Data badge (updated later via updateNodeBadges)
  g.append("text")
    .attr("class", "node-badge")
    .attr("x", 0)
    .attr("y", d => {
      const sz = SHAPE_SIZES[d.shape];
      return (sz.radius || sz.ry || sz.height / 2 || 20) + 14;
    })
    .attr("text-anchor", "middle")
    .attr("font-size", d => (d.shape === "bs_parent" || d.shape === "bs_child") ? "8px" : "10px")
    .attr("fill", "#555")
    .attr("pointer-events", "auto");

  // Note: hover events are now bound directly on .node-shape elements above,
  // NOT on the group — this prevents text selection from triggering mouseleave
  // and allows users to select-copy node labels without dismissing tooltips.

  return g;
}

/** Highlight edges connected to the given node, dim others. */
function highlightConnected(svgEl, nodeId) {
  const connectedEdgeIds = new Set();
  const connectedNodeIds = new Set([nodeId]);

  EDGES.forEach(e => {
    if (e.source === nodeId || e.target === nodeId) {
      connectedEdgeIds.add(e.id);
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    }
  });

  const svg = d3.select(svgEl);
  svg.selectAll("g.edge").classed("dimmed", d => !connectedEdgeIds.has(d.id));
  svg.selectAll("g.node").classed("dimmed", d => !connectedNodeIds.has(d.id));
}

function resetHighlightAll(svgEl) {
  const svg = d3.select(svgEl);
  svg.selectAll(".dimmed").classed("dimmed", false);
}

/**
 * Update the small badge below each node with aggregate data.
 */
export function updateNodeBadges(nodeGroup, values, formatValue) {
  const badgeMap = {
    us_banks:              { sid: null },
    us_fbo:                { sid: "DPSFRIM027SBOG",    units: "Bil. USD" },
    dealers:               { sid: "BOGZ1FL664090663Q", units: "Mil. USD" },
    gov_mmf:               { sid: "BOGZ1FL634090033Q", units: "Mil. USD" },
    prime_mmf:             { sid: "MMMFFAQ027S",       units: "Bil. USD" },
    hedge_funds:           { sid: "BOGZ1FL622051003Q", units: "Mil. USD" },
    corporates_onshore:    { sid: "COMPAPER",          units: "Bil. USD" },
    fcb_swf_supra_onshore: { sid: "WSEFINTL1",         units: "Mil. USD" },
    fhlb:                  { sid: "BOGZ1FL403069330Q", units: "Mil. USD" },
    gse:                   { sid: "BOGZ1FL404090423Q", units: "Mil. USD" },
    us_treasury:           { sid: "GFDEBTN",           units: "Mil. USD" },
    bs_reserve_balances:   { sid: "WRESBAL",           units: "Mil. USD" },
    bs_rrp:                { sid: "RRPONTTLD",         units: "Bil. USD" },
    bs_foreign_repo:       { sid: "WDFOA",             units: "Mil. USD" },
    bs_treasuries:         { sid: "TREAST",            units: "Mil. USD" },
  };

  nodeGroup.select(".node-badge")
    .text(d => {
      const cfg = badgeMap[d.id];
      if (!cfg || !cfg.sid) return "";
      const v = values?.[cfg.sid];
      return v != null ? formatValue(v, cfg.units) : "";
    });
}
