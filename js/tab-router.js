/**
 * tab-router.js — minimal v1/v2 tab switcher.
 * Does not touch v1 rendering. v2 is loaded lazily on first activation.
 */
const STORAGE_KEY = "usdff-active-tab";

let v2Loaded = false;

async function ensureV2Loaded() {
  if (v2Loaded) return;
  try {
    const { initV2 } = await import("./v2/app.js");
    await initV2();
    v2Loaded = true;
  } catch (err) {
    console.error("[tab-router] failed to load v2:", err);
  }
}

function activate(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-pane").forEach((p) => {
    const match = p.dataset.pane === tab;
    p.classList.toggle("active", match);
    p.hidden = !match;
  });
  if (tab === "v2") ensureV2Loaded();
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch (_) {
    /* storage may be disabled; ignore */
  }
}

function init() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
  activate(saved === "v2" ? "v2" : "v1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
