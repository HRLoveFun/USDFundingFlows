/**
 * app.js — Entry point.
 * DataLoader → Diagram → TimeSelector → Sidebar → render latest date.
 */
import DataLoader from "./data-loader.js";
import { render as renderDiagram, updateValues, highlightTransactionType } from "./diagram.js";
import { initTimeSelector } from "./time-selector.js";
import { initSidebar } from "./sidebar.js";
import { initTooltip, showNodeTooltip, showEdgeTooltip, hideTooltip } from "./tooltip.js";

const loader = new DataLoader();

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load data
  await loader.load();

  // 2. Tooltip
  initTooltip();

  // Keep track of current date for tooltip data
  let currentDate = loader.dates[loader.dates.length - 1];

  // 3. Render diagram
  renderDiagram(document.getElementById("diagram-container"), {
    onNodeHover: (node, event) => {
      const values = loader.getValuesForDate(currentDate);
      showNodeTooltip(node, event, values, loader.metadata, loader.formatValue);
    },
    onNodeOut: hideTooltip,
    onEdgeHover: (edge, event) => {
      const values = loader.getValuesForDate(currentDate);
      showEdgeTooltip(edge, event, values, loader.metadata, loader.formatValue);
    },
    onEdgeOut: hideTooltip,
  });

  // 4. Initial values
  updateValues(currentDate, loader);

  // 5. Time selector
  const timeSelectorEl = document.getElementById("time-selector");
  initTimeSelector(timeSelectorEl, loader.dates, (date) => {
    currentDate = date;
    updateValues(date, loader);
  });

  // 6. Sidebar
  initSidebar(document.getElementById("sidebar"), {
    onTypeSelect: (typeId) => highlightTransactionType(typeId),
  });
});
