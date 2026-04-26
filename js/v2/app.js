/**
 * v2/app.js — entry point for the optimized (v2) diagram.
 * Lazy-loaded by js/tab-router.js on first activation of the v2 tab.
 *
 * S3.4: hooks the existing v1 time-selector DOM (`#date-select` /
 * `#date-slider` injected by `js/time-selector.js`) and re-renders v2
 * badges on date change — closing the v2 data-flow loop without
 * modifying v1's app.js / sidebar.js / time-selector.js.
 */
import DataLoader from "../data-loader.js";
import { initDiagram, updateBadges } from "./diagram.js";

let initialized = false;

export async function initV2() {
  if (initialized) return;
  const svg = document.getElementById("diagram-svg-v2");
  if (!svg) throw new Error("[v2] SVG container missing");

  // Reuse v1's DataLoader instance if already loaded; otherwise create one.
  let dataLoader = window.__v1DataLoader;
  if (!dataLoader) {
    dataLoader = new DataLoader();
    await dataLoader.load();
  } else if (!dataLoader.dates || dataLoader.dates.length === 0) {
    // v1 instance exists but is still loading or hasn't been kicked off — wait/load.
    await dataLoader.load();
  }
  window.__v2DataLoader = dataLoader;

  initDiagram(svg, dataLoader);
  wireTimeSelector(dataLoader);
  initialized = true;
  console.log("[v2] initialized");
}

/**
 * Listen on the v1 time-selector DOM nodes additively. v1 attaches its
 * own listeners; ours coexist (multiple `change`/`input` listeners are
 * fine). We never call any v1 setter — we only read the selected date
 * and forward it to `updateBadges`.
 *
 * Slider `input` fires every drag tick → coalesce with a 50 ms timeout
 * (matches v1's `SLIDER_DEBOUNCE_MS`) so badge re-renders don't thrash.
 */
function wireTimeSelector(dataLoader) {
  const select = document.getElementById("date-select");
  const slider = document.getElementById("date-slider");
  if (!select && !slider) {
    console.warn("[v2] time-selector DOM not found — badges will not follow date");
    return;
  }
  if (select) {
    select.addEventListener("change", () => {
      if (select.value) updateBadges(select.value);
    });
  }
  if (slider) {
    let timer = null;
    slider.addEventListener("input", () => {
      const idx = parseInt(slider.value, 10);
      const date = Number.isInteger(idx) ? dataLoader.dates?.[idx] : null;
      if (!date) return;
      clearTimeout(timer);
      timer = setTimeout(() => updateBadges(date), 50);
    });
  }
}
