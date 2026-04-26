/**
 * v2/layout/panels.js — re-export of v1's section hierarchy as the
 * v2 panel layout source-of-truth.
 *
 * S2 baseline policy: v2 panels mirror v1 exactly so the optimized
 * view opens visually identical to the NY Fed 2019 reference. Future
 * modules may extend this with v2-only frames; for now we just expose
 * convenience views over v1's flat SECTIONS list.
 */

import { SECTIONS, ANNOTATIONS } from "../../constants.js";

/** Flat section list (level 1..4) — same data v1 renders. */
export const PANELS = SECTIONS;

/** Column / annotation labels (e.g., "Assets" / "Liabilities" headers). */
export { ANNOTATIONS };

/** Dashed-gray groups (level 4 in v1) — convenience filter. */
export const DASH_GROUPS = SECTIONS.filter(s => s.style === "dashed_gray");

/** Iterator helper kept for forward compatibility. */
export function flattenPanels() {
  return SECTIONS.slice();
}
