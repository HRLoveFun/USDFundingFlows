/**
 * tooltip.js — Follow-mouse tooltip for nodes and edges.
 * Uses requestAnimationFrame throttling to reduce DOM writes during mouse move.
 *
 * Text-selection / hover conflict resolution:
 *   1. Global selection state tracking via selectionchange event
 *   2. Deferred hide (200ms grace period) so quick text drags don't kill tooltips
 *   3. isSelecting() guard — suppresses show while user has active text selection
 */
import { EDGE_COLORS } from "./constants.js";

let tooltipEl;
let rafId = null;
let lastContent = "";

// ── Selection state tracking ─────────────────────────────────────────────
/** Whether the user currently has an active text selection. */
let _hasSelection = false;
let _hideTimer = null;

// Grace period: if hide is called but user is selecting, wait this long
const HIDE_GRACE_MS = 200;

/**
 * Check if any text is currently selected on the page.
 * Returns true when the user is actively selecting or has a non-empty selection.
 */
export function isSelecting() {
  const sel = window.getSelection();
  if (!sel) return false;
  // Non-collapsed selection = user has selected something
  if (!sel.isCollapsed && sel.toString().trim().length > 0) {
    _hasSelection = true;
    return true;
  }
  return false;
}

/** Listen for selection changes globally. */
function initSelectionTracker() {
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    _hasSelection = !!(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
    // If user cleared selection, cancel any pending hide
    if (!_hasSelection && _hideTimer) {
      clearTimeout(_hideTimer);
      _hideTimer = null;
    }
  });
}

export function initTooltip() {
  tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  tooltipEl.className = "tooltip hidden";
  document.body.appendChild(tooltipEl);
  initSelectionTracker();
}

export function showNodeTooltip(node, event, values, metadata, formatValue) {
  // Suppress tooltip while user has an active text selection
  if (_hasSelection || isSelecting()) return;

  let html = `<strong>${node.label.replace(/\n/g, " ")}</strong>`;

  updateTooltip(html, event);
}

export function showEdgeTooltip(edge, event, values, metadata, formatValue) {
  // Suppress tooltip while user has an active text selection
  if (_hasSelection || isSelecting()) return;

  const ec = EDGE_COLORS[edge.color];
  let html = `<strong>${edge.label || edge.id}</strong>`;
  html += `<br><em style="color:${ec?.color ?? '#999'}">${ec?.name ?? edge.color}</em>`;

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

/**
 * Hide tooltip with a short grace period.
 * If user is actively selecting text, the hide is deferred to avoid flicker.
 */
export function hideTooltip() {
  // If user is selecting, defer the hide — it may be a drag across text
  if (_hasSelection || isSelecting()) {
    if (_hideTimer) clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      _hideTimer = null;
      if (!_hasSelection) doHide();
    }, HIDE_GRACE_MS);
    return;
  }
  doHide();
}

function doHide() {
  cancelAnimationFrame(rafId);
  lastContent = "";
  tooltipEl?.classList.add("hidden");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
