/**
 * v2/app.js — entry point for the optimized (v2) diagram.
 * Lazy-loaded by js/tab-router.js on first activation of the v2 tab.
 */
import DataLoader from "../data-loader.js";
import { initDiagram } from "./diagram.js";

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
  initialized = true;
  console.log("[v2] initialized");
}
