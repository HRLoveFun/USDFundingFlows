/**
 * app.js — Entry point.
 * DataLoader → Diagram → TimeSelector → Sidebar.
 */
import DataLoader from "./data-loader.js";
import { render as renderDiagram, highlightTransactionType } from "./diagram.js";
import { initTimeSelector } from "./time-selector.js";
import { initSidebar } from "./sidebar.js";
import { initTooltip, showNodeTooltip, showEdgeTooltip, hideTooltip } from "./tooltip.js";

const loader = new DataLoader();

document.addEventListener("DOMContentLoaded", async () => {
  await loader.load();

  initTooltip();

  renderDiagram(document.getElementById("diagram-container"), {
    onNodeHover: showNodeTooltip,
    onNodeOut:   hideTooltip,
    onEdgeHover: showEdgeTooltip,
    onEdgeOut:   hideTooltip,
  });

  const timeSelectorEl = document.getElementById("time-selector");
  initTimeSelector(timeSelectorEl, loader.dates);

  initSidebar(document.getElementById("sidebar"), {
    onTypeSelect: (typeId) => highlightTransactionType(typeId),
  });
});

// Expose the data loader so v2 (lazy-loaded) can reuse the same instance
// instead of fetching JSON twice.
window.__v1DataLoader = loader;
