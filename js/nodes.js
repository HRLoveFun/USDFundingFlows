/**
 * nodes.js — D3 rendering of entity nodes with multiple shapes.
 * Shapes: hexagon (banks), pentagon (dealers), circle (investors),
 *         rectangle (Treasury), bs_item (balance sheet items).
 */
import { NODES, EDGES, SHAPE_COLORS, SHAPE_SIZES, SECTIONS, ANNOTATIONS } from "./constants.js";

// ── Shape generators ────────────────────────────────────────────────────

function hexagonPoints(r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

function pentagonPoints(r) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = (2 * Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

// ── Section / group background rendering ────────────────────────────────

export function renderSections(layer) {
  // Render each section as a background rectangle
  const sectionOrder = ["fed", "bs", "market", "onshore", "offshore",
    "banks_dealers", "onshore_inv", "institutional_inv", "gov_entities"];

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
    .attr("rx", d => d.style === "dashed" ? 0 : 6)
    .attr("fill", d => {
      if (d.style === "header") return "#f5f5f5";
      if (d.style === "subheader") return "#fafafa";
      if (d.style === "dashed") return "none";
      return "#ffffff";
    })
    .attr("stroke", d => {
      if (d.style === "header") return "#bdbdbd";
      if (d.style === "dashed") return "#999";
      return "#e0e0e0";
    })
    .attr("stroke-width", d => d.style === "dashed" ? 1.5 : 1)
    .attr("stroke-dasharray", d => d.style === "dashed" ? "6,4" : "");

  // Section headers
  g.each(function (d) {
    if (!d.label) return;
    const sel = d3.select(this);
    if (d.style === "header") {
      // Dark gray bar with white text
      sel.append("rect")
        .attr("x", d.x)
        .attr("y", d.y)
        .attr("width", d.w)
        .attr("height", 32)
        .attr("rx", 6)
        .attr("fill", "#424242");
      sel.append("text")
        .attr("x", d.x + d.w / 2)
        .attr("y", d.y + 21)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-size", "14px")
        .attr("font-weight", 700)
        .attr("letter-spacing", "1px")
        .text(d.label);
    } else if (d.style === "subheader") {
      sel.append("text")
        .attr("x", d.x + d.w / 2)
        .attr("y", d.y + 18)
        .attr("text-anchor", "middle")
        .attr("fill", "#757575")
        .attr("font-size", "12px")
        .attr("font-weight", 700)
        .attr("letter-spacing", "0.5px")
        .text(d.label);
    } else if (d.style === "group") {
      sel.append("text")
        .attr("x", d.x + 10)
        .attr("y", d.y + 16)
        .attr("fill", "#888")
        .attr("font-size", "11px")
        .attr("font-weight", 600)
        .text(d.label);
    }
  });

  // Annotations
  const ann = layer.selectAll("text.annotation")
    .data(ANNOTATIONS)
    .join("text")
      .attr("class", "annotation")
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("text-anchor", "middle")
      .attr("fill", d => d.fill)
      .attr("font-size", d => d.fontSize + "px")
      .attr("font-weight", d => d.fontWeight || 400)
      .attr("font-style", d => d.fontStyle || "normal")
      .text(d => d.text);
}

// ── Node rendering ──────────────────────────────────────────────────────

export function renderNodes(layer, { onNodeHover, onNodeOut }) {
  const g = layer.selectAll("g.node")
    .data(NODES, d => d.id)
    .join("g")
      .attr("class", d => `node node-${d.shape}`)
      .attr("transform", d => `translate(${d.x},${d.y})`);

  // Draw shape per type
  g.each(function (d) {
    const sel = d3.select(this);
    const fill = SHAPE_COLORS[d.shape];
    const sz = SHAPE_SIZES[d.shape];

    switch (d.shape) {
      case "hexagon": {
        sel.append("polygon")
          .attr("points", hexagonPoints(sz.radius))
          .attr("fill", fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92);
        break;
      }
      case "pentagon": {
        sel.append("polygon")
          .attr("points", pentagonPoints(sz.radius))
          .attr("fill", fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92);
        break;
      }
      case "circle": {
        sel.append("circle")
          .attr("cx", 0).attr("cy", 0)
          .attr("r", sz.radius)
          .attr("fill", fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92);
        break;
      }
      case "rectangle": {
        sel.append("rect")
          .attr("x", -sz.width / 2).attr("y", -sz.height / 2)
          .attr("width", sz.width).attr("height", sz.height)
          .attr("rx", 6)
          .attr("fill", fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.92);
        break;
      }
      case "bs_item": {
        sel.append("rect")
          .attr("x", -sz.width / 2).attr("y", -sz.height / 2)
          .attr("width", sz.width).attr("height", sz.height)
          .attr("rx", 4)
          .attr("fill", fill)
          .attr("stroke", "#bbb")
          .attr("stroke-width", 0.8);
        break;
      }
    }
  });

  // Multi-line label
  g.each(function (d) {
    const lines = d.label.split("\n");
    const isBs = d.shape === "bs_item";
    const text = d3.select(this).append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", isBs ? "#333" : "#fff")
      .attr("font-size", isBs ? "9px" : "10px")
      .attr("font-weight", isBs ? 500 : 600)
      .attr("pointer-events", "none");

    const lineHeight = isBs ? 11 : 13;
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
      return (sz.radius || sz.height / 2 || 20) + 14;
    })
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#555");

  // Hover events
  g.on("mouseenter", function (event, d) {
    onNodeHover?.(d, event);
    highlightConnected(layer.node().parentNode, d.id);
  })
  .on("mouseleave", function (event, d) {
    onNodeOut?.(d);
    resetHighlightAll(layer.node().parentNode);
  });

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
