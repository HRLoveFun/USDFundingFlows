/**
 * v2/constants.js — node and edge data for the v2 diagram.
 *
 * S2 baseline policy: v2 reuses v1's complete node/section dataset so
 * the optimized view starts visually identical to the NY Fed 2019
 * reference. Modules C / D / E will append v2-only nodes (SRF / DW
 * advances / Foreign RRP pool / etc.) and edges on top of this base.
 *
 * Module C addition: every node / edge is decorated with a `.proxy`
 * field resolved against `proxy_registry.js`. Attaching metadata does
 * NOT change the visual baseline — coordinates, shapes and labels are
 * preserved verbatim from v1.
 *
 * EDGES stays empty in S2 — edge rendering is the responsibility of
 * Module C (proxy binding) and Module E (new connections). When edges
 * are pushed they should expose a `transaction_type` so `withEdgeProxy`
 * can resolve their proxy.
 */

import { NODES as V1_NODES } from "../constants.js";
import {
  NODE_PROXIES,
  EDGE_PROXIES,
  getNodeProxy,
  getEdgeProxy,
} from "./proxy_registry.js";

/** Decorate a v1 node with its proxy record (non-mutating copy). */
function withNodeProxy(n) {
  return { ...n, proxy: getNodeProxy(n.id) };
}

/** Decorate a raw edge with its proxy record (non-mutating copy). */
export function withEdgeProxy(e) {
  return { ...e, proxy: getEdgeProxy(e.transaction_type) };
}

/** v2 node list — v1 NODES + proxy metadata. */
export const NODES = V1_NODES.map(withNodeProxy);

/**
 * v2 edge list — Module E (S4) introduces three v2-only connections
 * absent from the NY Fed 2019 reference diagram:
 *   1. Discount Window / Primary Credit Facility
 *   2. Foreign Repo Pool (FCB / SWF reverse repo with Fed)
 *   3. Standing Repo Facility (SRF, established 2021-07-28)
 *
 * Endpoint mapping note (S4 / pre-S3 dedicated nodes):
 *   Module C plans dedicated v2-only Fed-side nodes (`fed_repo_assets`,
 *   `fed_lending`). Until they exist we attach to the closest existing
 *   v1 balance-sheet line so the edges render. Re-target later.
 *
 * Each raw edge is wrapped in `withEdgeProxy()` so consumers receive
 * `.proxy` metadata resolved against `proxy_registry.js`.
 */
export const EDGES = [
  {
    id: "edge_dw",
    source: "us_banks",
    target: "bs_primary_credit",         // Primary Credit Facility = DW asset
    transaction_type: "discount_window",
    label: "Discount Window",
    style: { color: "#9467bd", dash: "6 3" },
  },
  {
    id: "edge_foreign_rrp",
    source: "fcb_swf_supra_offshore",
    target: "bs_foreign_repo",           // Foreign repo pool already on v1 BS
    transaction_type: "on_rrp",
    variant: "foreign",
    label: "Foreign Repo Pool",
    style: { color: "#17becf" },
  },
  {
    id: "edge_srf",
    source: "dealers",
    // TODO(Module C / S3): re-target to dedicated `fed_repo_assets`.
    target: "bs_others_assets",
    transaction_type: "srf",
    label: "SRF",
    style: { color: "#d62728", dash: "4 2", arrow: "double" },
  },
].map(withEdgeProxy);

/**
 * Legend entries for the three v2-only transaction types. Consumed by
 * the v2 sidebar (Transaction Types panel) once it is wired up.
 * Kept as pure data here so non-rendering code can reuse it.
 */
export const TRANSACTION_TYPES_V2_NEW = [
  { id: "discount_window",  name: "Discount Window",         color: "#9467bd" },
  { id: "on_rrp_foreign",   name: "Foreign Repo Pool",       color: "#17becf" },
  { id: "srf",              name: "Standing Repo Facility",  color: "#d62728" },
];

// Re-export registry tables so consumers (tooltip, badge overlay) can
// read them without an extra import.
export { NODE_PROXIES, EDGE_PROXIES };
