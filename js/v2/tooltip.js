/**
 * v2/tooltip.js — proxy-aware tooltip for the v2 diagram.
 *
 * Hovering a v2 node surfaces its proxy record from `proxy_registry.js`
 * and the latest value from the shared data loader (when the proxy
 * series exists in time_series.json).
 *
 * Sources outside FRED (Treasury / NYFed / OFR / External) are shown
 * with their source label only.
 *
 * Implementation notes:
 *   - Singleton DOM node `<div class="tooltip-v2 hidden">` appended to
 *     `<body>` on first init — independent from v1's tooltip.
 *   - `showNodeProxy` accepts a `dataLoader` so the tooltip can look up
 *     the latest series value lazily.
 */

let tooltipEl = null;

const STATUS_LABEL = {
  ok:        "",
  partial:   "partial — manual download required",
  external:  "external — out-of-band data source",
  not_found: "no public proxy",
};

/** Initialise the singleton tooltip element (idempotent). */
export function initTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "tooltip-v2 hidden";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

/** Hide the tooltip. */
export function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.classList.add("hidden");
}

function positionTooltip(event) {
  if (!tooltipEl) return;
  const pad = 12;
  const { clientX: x, clientY: y } = event;
  const rect = tooltipEl.getBoundingClientRect();
  let left = x + pad;
  let top  = y + pad;
  if (left + rect.width  > window.innerWidth)  left = x - rect.width  - pad;
  if (top  + rect.height > window.innerHeight) top  = y - rect.height - pad;
  tooltipEl.style.left = `${Math.max(8, left)}px`;
  tooltipEl.style.top  = `${Math.max(8, top)}px`;
}

function escape(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function renderProxyLine(label, p, dataLoader) {
  if (!p) return "";
  const note = p.note ? ` <span class="tt-note">(${escape(p.note)})</span>` : "";
  let valueHtml = "";
  if (p.source === "FRED" && dataLoader) {
    const hit = latestSeriesValue(dataLoader, p.series);
    if (hit) {
      const meta  = dataLoader.metadata?.[p.series] ?? {};
      const units = meta.units ?? "";
      const fv    = dataLoader.formatValue?.(hit.value, units) ?? hit.value;
      valueHtml = ` → <strong>${escape(fv)}</strong> <span class="tt-date">(${hit.date})</span>`;
    }
  }
  return `<div class="tt-row"><span class="tt-label">${label}:</span> ${escape(p.source)} · <code>${escape(p.series ?? "")}</code>${
    p.metric ? ` · <em>${escape(p.metric)}</em>` : ""
  }${valueHtml}${note}</div>`;
}

function renderStatus(proxy_status) {
  if (!proxy_status || proxy_status === "ok") return "";
  return `<div class="tt-status tt-status-${proxy_status}">⚠ ${escape(STATUS_LABEL[proxy_status] ?? proxy_status)}</div>`;
}

/**
 * @param {object} node            v1 NODE record (we look up proxy by id)
 * @param {Event}  event           pointer event
 * @param {object} dataLoader      v1 DataLoader instance (optional)
 * @param {object} [proxyRegistry] NODE_PROXIES map (overrides node.proxy)
 */
export function showNodeProxy(node, event, dataLoader, proxyRegistry) {  const el = initTooltip();
  const proxy = proxyRegistry?.[node.id] ?? node.proxy ?? null;
  const title = `<div class="tt-title">${escape(node.label?.replace(/\n/g, " ") ?? node.id)}</div>`;
  if (!proxy) {
    el.innerHTML = title + `<div class="tt-row tt-muted">no proxy registered</div>`;
  } else {
    el.innerHTML =
      title +
      renderProxyLine("primary",   proxy.primary,   dataLoader) +
      renderProxyLine("secondary", proxy.secondary, dataLoader) +
      (proxy.rationale ? `<div class="tt-rationale">${escape(proxy.rationale)}</div>` : "") +
      renderStatus(proxy.proxy_status);
  }
  el.classList.remove("hidden");
  positionTooltip(event);
}

/**
 * Minimal hover tooltip for proxy-value badges (S3.2 + S3.3).
 *
 * S3.2 surfaces:
 *   - proxy 简写: source · proxy_id · frequency · units
 *   - observation YYYY-MM (FRED hit) / last updated YYYY-MM (non-FRED)
 *
 * S3.3 adds (when present in the `extras` object):
 *   - stale line:     "stale: <N>d since YYYY-MM (threshold <T>d)"
 *   - violation line: "cross-source diff > 5% — see registry alternates"
 *     plus the matching pair record from `data/json/cross_source_diff.json`
 *
 * For nodes whose `primary === null` this surfaces the registry `reason`.
 *
 * @param {object} node       v2 NODE (decorated with proxy)
 * @param {Event}  event      pointer event
 * @param {object} dataLoader v1 DataLoader instance (optional)
 * @param {string|null} [obsDate] observation date YYYY-MM-DD resolved by badge
 * @param {{stale?: object|null, violation?: boolean, crossDiff?: object|null}} [extras]
 */
export function showBadgeProxy(node, event, dataLoader, obsDate = null, extras = {}) {
  const el = initTooltip();
  const proxy = node.proxy ?? null;
  const title = `<div class="tt-title">${escape(node.label?.replace(/\n/g, " ") ?? node.id)}</div>`;
  if (!proxy) {
    el.innerHTML = title + `<div class="tt-row tt-muted">no proxy registered</div>`;
    el.classList.remove("hidden");
    positionTooltip(event);
    return;
  }
  if (proxy.primary == null) {
    el.innerHTML =
      title +
      `<div class="tt-row tt-muted">primary: <em>null</em></div>` +
      (proxy.reason ? `<div class="tt-rationale tt-muted">${escape(proxy.reason)}</div>` : "");
    el.classList.remove("hidden");
    positionTooltip(event);
    return;
  }
  const p = proxy.primary;
  const freqUnits = [p.frequency, p.units].filter(Boolean).join(" · ");
  const ymObs = obsDate
    ? obsDate.slice(0, 7)
    : (proxy.last_updated ? proxy.last_updated.slice(0, 7) : null);
  const obsLabel = obsDate ? "observation" : "last updated";

  // S3.3 extras
  const stale     = extras?.stale ?? null;
  const violation = extras?.violation === true;
  const crossDiff = extras?.crossDiff ?? null;

  let staleLine = "";
  if (stale) {
    staleLine = `<div class="tt-row tt-stale">⚠ stale: ${stale.ageDays}d since ${escape(stale.since)} (threshold ${stale.threshold}d)</div>`;
  }

  let violationLine = "";
  if (violation) {
    const pair = findViolationPair(node.id, crossDiff);
    if (pair) {
      const cand = pair.candidate ?? {};
      const comp = pair.comparator ?? {};
      const diffPct = pair.relative_diff_pct != null ? pair.relative_diff_pct.toFixed(1) : "?";
      violationLine =
        `<div class="tt-row tt-violation">⚠ cross-source diff ${diffPct}% &gt; 5%</div>` +
        `<div class="tt-row tt-muted">${escape(cand.source)} <code>${escape(cand.series ?? "")}</code> vs ${escape(comp.source)} <code>${escape(comp.series ?? "")}</code></div>`;
    } else {
      violationLine = `<div class="tt-row tt-violation">⚠ cross-source diff &gt; 5%</div>`;
    }
  }

  el.innerHTML =
    title +
    `<div class="tt-row"><span class="tt-label">proxy:</span> ${escape(p.source)} · <code>${escape(p.proxy_id ?? "")}</code></div>` +
    (freqUnits ? `<div class="tt-row tt-muted">${escape(freqUnits)}</div>` : "") +
    (ymObs ? `<div class="tt-row tt-date">${escape(obsLabel)}: ${escape(ymObs)}</div>` : "") +
    staleLine +
    violationLine;
  el.classList.remove("hidden");
  positionTooltip(event);
}

/** Locate the same_concept pair that triggered the 5% violation for node_id. */
function findViolationPair(nodeId, crossDiff) {
  const pairs = crossDiff?.pairs;
  if (!Array.isArray(pairs)) return null;
  for (const pr of pairs) {
    if (pr.node_id !== nodeId) continue;
    if (pr.same_concept !== true) continue;
    if (pr.substitute === true) continue;
    if (typeof pr.relative_diff_pct !== "number") continue;
    if (Math.abs(pr.relative_diff_pct) > 5) return pr;
  }
  return null;
}
