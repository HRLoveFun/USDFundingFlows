/**
 * v2/constants.js — node data for the v2 diagram.
 *
 * v2 reuses v1's node/section dataset so the optimized view starts
 * visually identical to the NY Fed 2019 reference. Each node is
 * decorated with a `.proxy` field resolved against `proxy_registry.js`.
 * Attaching metadata does NOT change the visual baseline — coordinates,
 * shapes and labels are preserved verbatim from v1.
 */

import { NODES as V1_NODES } from "../constants.js";
import { NODE_PROXIES, getNodeProxy } from "./proxy_registry.js";

/** Decorate a v1 node with its proxy record (non-mutating copy). */
function withNodeProxy(n) {
  return { ...n, proxy: getNodeProxy(n.id) };
}

/** v2 node list — v1 NODES + proxy metadata. */
export const NODES = V1_NODES.map(withNodeProxy);

// Re-export registry table so consumers (tooltip, badge overlay) can
// read it without an extra import.
export { NODE_PROXIES };
