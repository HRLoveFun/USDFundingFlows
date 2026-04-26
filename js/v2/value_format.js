/**
 * v2/value_format.js — formatting helper for proxy badge values.
 *
 * Plan row 3.3 deliverable. Single-purpose wrapper that:
 *   - Delegates to v1 `DataLoader.formatValue(value, units)` when a
 *     loader is available (keeps formatting consistent across v1 & v2).
 *   - Provides a self-contained fallback so non-FRED proxies (which
 *     bypass the cached snapshot) can still render with the same
 *     "金额 $1.23T / 利率 4.32% / bps 整数" rules called out in plan 3.3.
 *
 * Intentionally tiny: this is the only place v2 decides how a numeric
 * proxy value renders inside a 14-px badge.
 */

/** Format a proxy value to a short string. */
export function formatValue(value, units, dataLoader = null) {
  if (value == null || (typeof value === "number" && Number.isNaN(value))) {
    return "N/A";
  }
  if (dataLoader && typeof dataLoader.formatValue === "function") {
    // Reuse v1 formatter — single source of truth for rate/USD/bps.
    return dataLoader.formatValue(value, units);
  }
  return fallbackFormat(value, units);
}

function fallbackFormat(value, units) {
  if (units && /percent|%/i.test(units)) return value.toFixed(2) + "%";
  if (units && /bps/i.test(units))       return Math.round(value).toString();
  let billions = null;
  if (units === "Mil. USD")            billions = value / 1000;
  else if (units === "Bil. USD")       billions = value;
  else if (units === "Bil. USD/day")   billions = value;
  if (billions != null) {
    if (Math.abs(billions) >= 1000) return "$" + (billions / 1000).toFixed(1) + "T";
    return "$" + billions.toFixed(1) + "B";
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
