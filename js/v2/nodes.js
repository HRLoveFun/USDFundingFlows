/**
 * v2/nodes.js — node renderer.
 *
 * S2 baseline policy: delegate to v1's `renderNodes` so v2 starts
 * visually identical to the NY Fed 2019 reference. Future modules
 * (C: proxy badges, D: spread channels, F: pressure overlays) will
 * fork their own logic by replacing this thin wrapper.
 *
 * The wrapper keeps a stable v2 import surface so call sites in
 * `v2/diagram.js` don't need to change when the renderer evolves.
 */

import { renderNodes as renderV1Nodes } from "../nodes.js";

/**
 * @param {d3.Selection} layer  parent <g> selection (d3, not raw DOM)
 * @param {{onNodeHover?: Function, onNodeOut?: Function}} [opts]
 */
export function renderNodes(layer, opts = {}) {
  const handlers = {
    onNodeHover: opts.onNodeHover ?? (() => {}),
    onNodeOut:   opts.onNodeOut   ?? (() => {}),
  };
  return renderV1Nodes(layer, handlers);
}
