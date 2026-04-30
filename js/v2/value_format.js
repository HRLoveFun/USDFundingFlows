/**
 * v2/value_format.js — formatting helper for proxy badge values.
 *
 * Delegates to v1 `DataLoader.formatValue(value, units)` so v1 & v2
 * share a single source of truth for rate/USD/bps formatting.
 */

/** Format a proxy value to a short string. */
export function formatValue(value, units, dataLoader) {
  if (value == null || (typeof value === "number" && Number.isNaN(value))) {
    return "N/A";
  }
  return dataLoader.formatValue(value, units);
}
