/**
 * v2/config.js — visual / layout configuration for the v2 diagram.
 * Independent of v1's config (Module B).
 */

export const CONFIG = {
  // SVG layout
  VIEWBOX_W: 2000,
  VIEWBOX_H: 1280,

  // Node visuals
  NODE_RADIUS: 4,

  // Layer z-order (low to high)
  LAYERS: ["panels", "dash-groups", "edges", "nodes"],
};
