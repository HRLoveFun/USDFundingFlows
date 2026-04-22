/**
 * data-loader.js — Async JSON loader and value formatter.
 * Loads time_series.json, series_metadata.json, available_dates.json.
 */

import { TIMING } from "./config.js";
const { FETCH_TIMEOUT } = TIMING;

class DataLoader {
  constructor() {
    this.timeSeries = {};   // { "2024-03-31": { "EFFR": 5.33, … } }
    this.metadata   = {};   // { "EFFR": { name, units, … } }
    this.dates      = [];   // ["2013-03-31", …]
  }

  async load(basePath = "data/json") {
    // Show loading indicator without destroying the container content
    const overlay = Object.assign(document.createElement("div"), {
      id: "loading-overlay",
      style: "position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:#666;background:rgba(255,255,255,0.85);z-index:10;",
      textContent: "Loading FRED data\u2026",
    });
    const container = document.getElementById("diagram-container");
    if (container) {
      container.style.position = "relative";
      container.appendChild(overlay);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const [ts, meta, dates] = await Promise.all([
        fetch(`${basePath}/time_series.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(`time_series.json: HTTP ${r.status}`); return r.json(); }),
        fetch(`${basePath}/series_metadata.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(`series_metadata.json: HTTP ${r.status}`); return r.json(); }),
        fetch(`${basePath}/available_dates.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(`available_dates.json: HTTP ${r.status}`); return r.json(); }),
      ]);

      clearTimeout(timer);
      this.timeSeries = ts;
      this.metadata   = meta;
      this.dates      = dates;
    } catch (err) {
      overlay.style.color = "#c00";
      overlay.style.fontSize = "20px";
      overlay.innerHTML = `Failed to load data:<br><code>${err.message}</code>`;
      console.error("DataLoader.load failed:", err);
      // Don't throw — allow partial init so other features may still work
    } finally {
      // Remove loading overlay after a short delay so initial render has time to paint
      setTimeout(() => overlay.remove(), TIMING.LOADING_OVERLAY_DELAY_MS);
    }
  }

  /** Return all series values for a given quarter-end date. */
  getValuesForDate(date) {
    return this.timeSeries[date] ?? {};
  }

  /**
   * Smart value formatter.
   *  - Rates      → "X.XX%"
   *  - Mil. USD   → "$X.XB" or "$X.XT" (converts millions → billions/trillions)
   *  - Bil. USD   → "$X.XB" or "$X.XT"
   *  - null/undef → "N/A"
   */
  formatValue(value, units) {
    if (value == null || value !== value) return "N/A";  // NaN check

    if (units && units.includes("%")) {
      return value.toFixed(2) + "%";
    }

    // Convert to billions for display
    let billions;
    if (units === "Mil. USD") {
      billions = value / 1000;
    } else if (units === "Bil. USD") {
      billions = value;
    } else if (units === "Bil. USD/day") {
      billions = value;
    } else {
      // Unknown unit — just return number
      return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
    }

    if (Math.abs(billions) >= 1000) {
      return "$" + (billions / 1000).toFixed(1) + "T";
    }
    return "$" + billions.toFixed(1) + "B";
  }
}

export default DataLoader;
