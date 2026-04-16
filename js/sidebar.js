/**
 * sidebar.js — Three collapsible panels:
 *  1. Arrow color filter buttons
 *  2. Legend (node shapes + edge colors)
 *  3. Searchable Glossary
 */
import { EDGE_COLORS, SHAPE_COLORS, GLOSSARY } from "./constants.js";

const SHAPE_LABELS = {
  hexagon:   "Intermediary institutions (Hexagon)",
  circle:    "Investor Institutions (Circle)",
  rectangle: "Government (Rectangle)",
};

export function initSidebar(container, { onTypeSelect }) {
  container.innerHTML = "";

  // ── Panel 1: Arrow Color Types ──────────────────────────────────────
  const ttPanel = createPanel("TRANSACTION TYPES", true);
  const ttList = document.createElement("div");
  ttList.className = "tt-buttons";

  // "ALL" button
  const allBtn = document.createElement("button");
  allBtn.className = "tt-btn active";
  allBtn.textContent = "ALL";
  allBtn.dataset.typeId = "";
  ttList.appendChild(allBtn);

  for (const [id, cfg] of Object.entries(EDGE_COLORS)) {
    const btn = document.createElement("button");
    btn.className = "tt-btn";
    // Display as: "ColorName | TransactionType"
    const colorLabel = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    btn.textContent = `${colorLabel} | ${cfg.name}`;
    btn.dataset.typeId = id;
    btn.style.borderLeftColor = cfg.color;
    ttList.appendChild(btn);
  }

  ttList.addEventListener("click", e => {
    const btn = e.target.closest(".tt-btn");
    if (!btn) return;
    ttList.querySelectorAll(".tt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    onTypeSelect(btn.dataset.typeId || null);
  });

  ttPanel.querySelector(".panel-body").appendChild(ttList);
  container.appendChild(ttPanel);

  // ── Panel 2: Legend ─────────────────────────────────────────────────
  const legPanel = createPanel("Legend", true);
  const legBody  = legPanel.querySelector(".panel-body");

  // Node shapes
  const catTitle = document.createElement("div");
  catTitle.className = "legend-subtitle";
  catTitle.textContent = "Node Shapes";
  legBody.appendChild(catTitle);

  for (const [shape, color] of Object.entries(SHAPE_COLORS)) {
    const row = document.createElement("div");
    row.className = "legend-row";
    const label = SHAPE_LABELS[shape] || shape;
    row.innerHTML = `<span class="legend-swatch" style="background:${color}"></span> ${label}`;
    legBody.appendChild(row);
  }

  // Arrow colors
  const edgeTitle = document.createElement("div");
  edgeTitle.className = "legend-subtitle";
  edgeTitle.textContent = "Colors";
  legBody.appendChild(edgeTitle);

  for (const [id, cfg] of Object.entries(EDGE_COLORS)) {
    const row = document.createElement("div");
    row.className = "legend-row";
    const svg = `<svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="${cfg.color}" stroke-width="2.5"/></svg>`;
    row.innerHTML = `${svg} <span>${cfg.name}</span>`;
    legBody.appendChild(row);
  }

  container.appendChild(legPanel);

  // ── Panel 3: Glossary ───────────────────────────────────────────────
  const glossPanel = createPanel("Glossary", false);
  const glossBody  = glossPanel.querySelector(".panel-body");

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search glossary…";
  search.className = "glossary-search";
  glossBody.appendChild(search);

  const glossList = document.createElement("dl");
  glossList.className = "glossary-list";

  GLOSSARY.forEach(g => {
    const dt = document.createElement("dt");
    dt.textContent = g.term;
    const dd = document.createElement("dd");
    dd.textContent = g.definition;
    glossList.appendChild(dt);
    glossList.appendChild(dd);
  });
  glossBody.appendChild(glossList);

  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    glossList.querySelectorAll("dt").forEach(dt => {
      const match = dt.textContent.toLowerCase().includes(q) ||
                    dt.nextElementSibling.textContent.toLowerCase().includes(q);
      dt.style.display = match ? "" : "none";
      dt.nextElementSibling.style.display = match ? "" : "none";
    });
  });

  container.appendChild(glossPanel);
}

// ── Helpers ───────────────────────────────────────────────────────────

function createPanel(title, open) {
  const panel = document.createElement("details");
  panel.className = "sidebar-panel";
  if (open) panel.open = true;

  const summary = document.createElement("summary");
  summary.className = "panel-header";
  summary.textContent = title;
  panel.appendChild(summary);

  const body = document.createElement("div");
  body.className = "panel-body";
  panel.appendChild(body);

  return panel;
}
