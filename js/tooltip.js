/**
 * tooltip.js — Follow-mouse tooltip for nodes and edges.
 * Uses requestAnimationFrame throttling to reduce DOM writes during mouse move.
 */
import { EDGE_COLORS } from "./constants.js";

let tooltipEl;
let rafId = null;
let lastContent = "";

export function initTooltip() {
  tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  tooltipEl.className = "tooltip hidden";
  document.body.appendChild(tooltipEl);
}

export function showNodeTooltip(node, event, values, metadata, formatValue) {
  let html = `<strong>${node.label.replace(/\n/g, " ")}</strong>`;
  html += `<br><em>${capitalize(node.shape)}</em>`;

  if (metadata && values) {
    for (const [sid, meta] of Object.entries(metadata)) {
      if (meta.node_ids?.includes(node.id) && values[sid] != null) {
        html += `<br>${meta.name}: <b>${formatValue(values[sid], meta.units)}</b>`;
      }
    }
  }

  updateTooltip(html, event);
}

export function showEdgeTooltip(edge, event, values, metadata, formatValue) {
  const ec = EDGE_COLORS[edge.color];
  let html = `<strong>${edge.label || edge.id}</strong>`;
  html += `<br><em style="color:${ec?.color ?? '#999'}">${ec?.name ?? edge.color}</em>`;

  for (const sid of edge.seriesIds) {
    const v   = values?.[sid];
    const m   = metadata?.[sid];
    const fmt = v != null ? formatValue(v, m?.units) : "N/A";
    html += `<br>${m?.name ?? sid}: <b>${fmt}</b>`;
  }

  updateTooltip(html, event);
}

function updateTooltip(html, event) {
  if (html === lastContent) {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      tooltipEl.style.left = (event.pageX + 14) + "px";
      tooltipEl.style.top  = (event.pageY + 14) + "px";
    });
    return;
  }
  lastContent = html;

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    tooltipEl.innerHTML = html;
    tooltipEl.style.left = (event.pageX + 14) + "px";
    tooltipEl.style.top  = (event.pageY + 14) + "px";
    tooltipEl.classList.remove("hidden");
  });
}

export function hideTooltip() {
  cancelAnimationFrame(rafId);
  lastContent = "";
  tooltipEl?.classList.add("hidden");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
