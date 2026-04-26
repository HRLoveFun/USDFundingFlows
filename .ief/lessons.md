# Lessons — USD Liquidity Visualization Optimization (v2)

> Phase 4 retrospective. Generated 2026-04-26.
> Sections 1–6 are model-drafted. Section 7 (Rollback Authorization) is filled only after **User Node ⑥** explicit per-lesson approval.
> The single source of truth for framework rollback remains `~/dev/ief-core/framework_lessons.md`; nothing here is auto-propagated.

## 1. Decision Quality Review

Outcome ∈ {correct, neutral, wrong, pending}. Cross-references live in [.ief/decisions.md](.ief/decisions.md) "Retrospective Annotations" table.

| ID | Outcome | Why | Lesson |
|---|---|---|---|
| **D-001** | correct | The 7 IN-set covered 12/12 gap nodes where any public proxy exists; 4 lifted live in S2.4. The 3 deferred (DTCC/SEC/IMF) never came up as blockers. | Whitelist scoping by node-coverage rather than by source-popularity gave a tight, justified set. |
| **D-002** | correct | The canonical schema held across S2.3, S2.4, S4.1 with **0 schema migrations** after freeze. `validate_registry_schema.py` passed 32/32 at every milestone. | Closing enums (`source`/`frequency`/`units`) before any harness writes prevented downstream re-debate. |
| **D-003** | correct | R009 fix (RPONTSYD→RRPONTTLD) caught a real series-ID error and lifted bs_rrp/bs_rrp_omo to corr=1.0; Option B for R008 (defer to S4.1) was correct because S4.1 metadata audit revealed *additional* problems that would have polluted S2.3. | "Defer to natural pipeline seam" beats "build dependency inside schema-migration step". |
| **D-004** | neutral (with caveat) | 4/9 lift target vs 5/9 handoff target was a deliberate, documented trade-off (PDF/Excel parser scope-creep avoidance). gov_mmf -0.97 cross-source negative-correlation interpretation held up under scrutiny. **Caveat**: securities_lenders OFR triparty alternate is a real concept-mismatch — the 4/9 honesty was the right call. | Honest "primary: null + reason" beats "fake primary to hit a numeric quality gate". The 5/9 target should have been pre-stated as a *stretch*, not an *exit gate*. |
| **D-005** | correct | The h≤14 + pad≤3 + 17-px clearance budget held through Path B (S4.2) **without modification** — Path B's new layout passed the same audit cleanly. 0/32 violations at project end. | Quantitative geometry budgets (px clearance tables) survive layout change in a way that "just measure it on screen" doesn't. |
| **D-006** | correct | 5-tier color matrix + frequency-tiered stale thresholds (D=7/W=21/M=60/Q=180) drove `cross_source_diff.json` consistently; bs_tga / us_treasury amber violation rendered as expected. | Dual-source-of-truth for thresholds (Python scanner + JS UI) is acceptable when the JS reads the JSON output of the Python — but **the duplicate constant table in `js/v2/badges.js` STALE_THRESHOLDS_DAYS is a latent risk**: any future change must touch both atomically. |
| **D-007** | wrong-then-corrected (overall correct) | Live `Fred.get_series_info` call at S4.1 surfaced that **2 of 3** S2.3-chosen R008 IDs were conceptually mismatched (CURRCIR freq/units; H8B1058NCBCMG concept). Correct response: demote to `primary: null` + log honestly rather than ship false-positive proxies. MBST kept despite 2018 discontinuation — debatable. | **Trust live source-of-truth metadata over inherited config strings.** S2.3 should have run `get_series_info` on every new ID at-write-time, not at-pipeline-time. |
| **D-008** | correct (forced) | User Node ② "Path B" was a scope-relaxation in response to **R012 drift** (uncommitted local edits to v1 layout). Post-Path-B audit revealed the original alarm (h=56) was wrong — actual h=50 → 20-px gap satisfies D-005. The new layout incidentally **fixed a latent 10-px violation** S3.1's audit had missed (bs_child/bs_parent treated as a unit). | Two distinct lessons: (a) verify shape-height constants at-the-source (config.js) before raising alarms; (b) audit scripts that conflate "parent + child" as one obstacle have a blind spot — re-audit on flat hierarchies. |
| **D-009** | accepted | User verbatim "Sign off" 2026-04-26. 8/12 AC fully met; 4/12 collapsed onto Node ④ (live data + visual hands-on); 6 next-cycle items acknowledged. | Front-loading visual + console acceptance into Node ④ rather than a pre-Node ④ Step worked because the project owner is also the visual reviewer. |

## 2. Estimation Accuracy

Plan ctx-cost letters: L=Low, M=Mid, H=High. Actual = post-hoc impression. Δ flagged where qualitative gap > 50%.

| Step | Planned Ctx | Actual | Δ | Cause |
|---|---|---|---|---|
| S1.1 FRED inventory | M | M | — | — |
| S1.2 NYFed inventory | M | M | — | — |
| S1.3 Treasury inventory | M | M | — | — |
| S1.4 Whitelist scoping | L | L | — | — |
| S1.5 Consolidate inventory | L | L | — | — |
| S2.1 Audit registry | L | M | **+1 tier** ⚠ | Writing `tools/audit_proxy_registry.py` with a JS-aware balanced-block parser was non-trivial; underestimated by treating it as "just a regex audit". |
| S2.2 Empirical harness | H | H | — | Correctly flagged for fresh conversation. |
| S2.3 Primary assignment | M | H | **+1 tier** ⚠ | Per-node primary table for 32 nodes + introducing `tools/validate_registry_schema.py` + R009 series-ID diagnosis pushed this past M. |
| S2.4 Whitelist fetchers | H | H | — | Correctly flagged. Three new source families + raw-cache wiring + harness extension fit the H budget exactly. |
| S2.5 Cross-source diff | M | M | — | — |
| S3.1 Badge collision | M | M | — | Pure offline geometry audit, fit M. |
| S3.2 Re-anchor + tooltip | M | M | — | Plan was correct that "no v1 fork needed" shrank scope. |
| S3.3 Stale + violation color | M | M | — | — |
| S3.4 Sidebar wiring | M | M | — | — |
| S4.1 Pipeline E2E rerun | L | **H** | **+2 tiers** ⚠⚠ | Plan assumed "just rerun fetchers". Actual: live FRED metadata audit revealed 2-of-3 R008 IDs misidentified, requiring registry surgery + D-007 (4-part decision). The "additive" `export_json.py` path was also non-trivial (had to prove v1-side inertness). **Largest single estimation miss in the project.** |
| S4.2 Visual regression | M | **H** | **+1 tier** ⚠ | Plan assumed v1 pixel-diff trivial. Actual: discovered uncommitted local v1 edits → R012 drift → user Node ② → Path B → spec amendment v0.2.1 → re-apply layout + D-008 (4-part). |
| S4.3 Browser console | L | M | **+1 tier** ⚠ | Agent cannot run real browser → had to design a 5-step static "console surrogate" (syntax / console.error scan / resource path check / Path B integrity / wireTimeSelector handshake). |
| S4.4 Sign-off | L | L | — | Correct. |
| S4.5 Retro prep | L | (this Step) | — | — |

**Aggregate**: 4 of 19 Steps (~21%) blew through their planned tier; 3 of those 4 cluster in **P4 (Integration & Acceptance)**. P1, P2, P3 estimation was within ±0.5 tier on every Step.

## 3. Validation Effectiveness

| Validation Method | Caught Real Defect? | Noise Rate | Verdict |
|---|---|---|---|
| `tools/audit_proxy_registry.py` | YES — found bs_fhlb_deposits coverage gap (S2.1) and continued to gate ERRORS=0 PENDING=0 across S2.3 / S2.4 / S4.1 / S4.2 | Low (no false positives observed) | **keep** |
| `tools/validate_registry_schema.py` | YES — caught enum-string typos and theory-length violations during S2.3 rewrite | Low | **keep** |
| `data/proxy_validation.py` 36M corr_36m | YES — surfaced R009 (RPONTSYD vs RRPONTTLD; corr=-0.25 was the smoking gun); later confirmed gov_mmf -0.97 substitution structure | Some signal-vs-noise judgement required (gov_mmf negative was real, not noise) | **keep**, but **adjust**: add a rule-of-thumb "|corr| < 0.5 OR sign mismatch with theory" → flag for human review rather than silently writing JSON |
| Anchor JSON + manual sanity check (3 nodes per Step) | YES — caught the R009 inversion before it shipped | None | **keep** |
| `cross_source_diff.json` 5% threshold scanner | YES — produced bs_tga / us_treasury violation IDs that drove amber rendering | None observed | **keep** |
| Static "console surrogate" (S4.3, ad-hoc) | UNKNOWN — covered syntax + reachable code paths but cannot detect runtime DOM/render bugs | — | **adjust**: surrogate is a partial substitute. Real-browser dev-tools must remain the Node ④ acceptance step; surrogate covers ~70% of common failure modes (syntax, missing resource, defensive-branch error spam). |
| Geometry clearance audit (D-005 method) | YES on Path B (re-audit caught the latent 10-px cross-column issue) but **MISSED** the same issue at S3.1 (treated parent+child as one obstacle) | — | **adjust**: when iterating on layouts, the audit must treat each individual rendered shape as an obstacle, not parent-child as a unit. Latent S3.1 blind spot. |
| Visual diff ("v1 pixel-level identical") | NOISY — original framing was too strict and broke at S4.2 against legitimate uncommitted improvements; user-relaxed to topology-level invariant in v0.2.1 | High (the strict pixel rule was the noise source itself) | **drop** in original strict form; **keep** the v0.2.1 invariant set (id / concept / topology / viewBox / edge-routing). |
| User Node ③ phase acceptance | YES — kept the project on rails | None | **keep** |
| User Node ② drift triage | YES — Path B was the right call at R012 | None | **keep** |

## 4. Risk Closure Audit

Every `risks.md` item ends in {closed, known-issue, transferred}.

| Risk | Final Status (lessons-frozen) | Rationale / Owner |
|---|---|---|
| R001 (cross-source overlap口径) | **transferred → cycle-2** | Mitigated by live `cross_source_diff.json`; ongoing freshness watch belongs to next-cycle pipeline owner. |
| R002 (extended whitelist coverage) | **closed (D-004)** | 4 of 9 lift; 5 deferred have explicit `null + reason`. |
| R003 (badge regression) | **closed (D-005)** | Quantitative clearance audit; survived Path B. |
| R004 (stale thresholds) | **closed (D-006)** | Per-frequency thresholds quantified and shipped. |
| R005 (short-history series) | **known-issue → cycle-2** | R005 fallback (corr_36m=null + note) is in production; long-tail SRF-class series will re-trigger. |
| R006 (extended-source CI dependencies) | **closed (D-004)** | Fail-soft pattern proven across OFR / NYFed-PD / CFTC. |
| R007 (5% amber color conflict) | **closed (S3.3)** | Amber `#fff3cd` chosen; no v1/v2 palette collision observed. |
| R008 (3 missing FRED series) | **partially closed → transferred (concept-mapping) to cycle-2** | Pipeline blocker resolved S4.1; foreign_banks/us_fbo concept gap → BIS locational fetcher candidate. |
| R009 (bs_rrp inversion) | **closed (D-003 Part A)** | Series ID corrected RPONTSYD → RRPONTTLD; corr=1.0/154. |
| R010 (TGA snapshot stale) | **closed (S4.1 pipeline rerun)** | Backfill confirmed; if it recurs, treat as fetcher health, not project risk. |
| R011 (NYFed unit metadata mismatch) | **closed (S4.1)** | Unit metadata corrected during S4.1 build. |
| R012 (v1 byte-equivalent violation) | **closed (D-008)** | Spec relaxed to v0.2.1; Path B accepted. |

**Final tally**: closed=9, known-issue→cycle-2=1, transferred→cycle-2=2, open=0. Exit criterion satisfied.

## 5. Process Friction

Free-form: places where IEF v0.2 added overhead without proportional value, or where the framework was actively helpful.

**Helpful (no friction)**
- Decision/risk separation (`decisions.md` vs `risks.md`) prevented 9 decisions from getting tangled with 12 risks. Tracking each as its own ledger row was clearly worth it.
- Quality Gate's per-Step 8-item checklist forced explicit "no silent spec edit" attestation, which caught zero silent edits but **deterred** at least one (S4.1 was tempted to silently relax §0.1.2 and didn't).
- User Node ② drift triage was the highest-leverage moment of the project — Branch C ("scope amend") was structurally available and used cleanly.
- Handoff packet rewriting at every Step (rather than once per Phase) meant no cold-start re-discovery cost.

**Friction (real)**
- The strict §0.1.2 "v1 byte-equivalent" invariant was over-restrictive from spec-freeze onwards; we discovered this only at S4.2. **The framework let an over-strict invariant ship into a frozen spec.** No checklist asks "is this invariant actually what we mean, or is it a measurement convenience?"
- "Plan ctx-cost in {L,M,H}" is too coarse. P4 Steps were systematically under-estimated because L/M/H doesn't distinguish "rerun pipeline" from "rerun pipeline AND audit metadata AND surface new problems".
- Drift Branch C ("uncommitted-but-correct work") needed roughly 4 sub-decisions packed into a single D-008 — the framework's "1 D-number per decision" convention strained.
- "Surrogate validation" when the agent can't run a real environment (browser, GUI) is not first-class in the framework. We ad-hoc'd S4.3 acceptably, but a future skill module could formalize this.
- The retrospective annotations table inside `decisions.md` ("pending" against each D-number) is good in theory but ended up duplicating fields with this `lessons.md`. Choose one as canonical.

**Neutral**
- Spec versioning (v0.1.0 → v0.2.0 → v0.2.1) worked but the version-history table and the AC#X amendments live in two different sections of `spec.md` — easy to update one without the other.

## 6. Lessons (structured)

Scope: `project` = USD Funding Flows specific; `framework` = candidates for rollback into `~/dev/ief-core/framework_lessons.md` (gated by §7).

| ID | Category | Phenomenon | Root cause | Improvement | Scope | User Approved Rollback |
|---|---|---|---|---|---|---|
| L001 | validation | Inherited series-ID strings from old config can be silently wrong (S4.1 D-007: CURRCIR freq, H8B1058NCBCMG concept, MBST discontinued). | Trust passed from old codebase to new schema without re-querying source-of-truth metadata. | At schema migration time, run live source-metadata API per ID and reconcile fields *before* writing the entry. | project | (pending §7) |
| L002 | validation | D-005 geometry audit treated `bs_parent` + `bs_child` as a single obstacle and missed a 10-px cross-column violation (Path B re-audit caught it). | Audit script conflated parent-child semantics with rendering geometry. | Audit obstacles = each rendered shape, period. Parent/child is a label, not a geometry primitive. | project | (pending §7) |
| L003 | estimation | P4 Steps systematically under-estimated (S4.1 L→H, S4.2 M→H, S4.3 L→M). | "L/M/H" ctx-cost letters don't distinguish "execute" from "execute + audit + surface findings". | For Integration phases, estimate against an "audit dimension" too — e.g. `ctx = (work, audit, drift_handling)` triple. Or always promote the rerun Step's estimate by one tier when rerunning produces metadata not previously verified. | framework | (pending §7) |
| L004 | decision | Drift Branch C (S4.2 R012 → D-008) packed 4 sub-decisions into one D-number (layout accept + re-audit + spec amend + R012 close). | "1 D-number per decision" convention strains under scope-amend events that touch ≥3 artifacts. | Either allow `D-008.A / .B / .C / .D` formal sub-numbering, or split spec amendments into their own D-class (`SPEC-001`-style). Document the convention. | framework | (pending §7) |
| L005 | process | Strict invariants (§0.1.2 "v1 byte-equivalent") shipped into frozen spec without a sanity check. | Bootstrap checklist doesn't prompt "is this invariant a goal or a measurement convenience?" | Add to `bootstrap.md` checklist: "for each MUST/SHALL invariant, articulate (a) what regression it actually prevents, (b) the minimal observable that proves it, (c) the relaxation path if it later proves over-strict." | framework | (pending §7) |
| L006 | tooling | Agent-cannot-run-real-browser created a forced "surrogate validation" gap at S4.3. | Framework treats validation as user-runnable; doesn't formalize agent-environment limits. | Add a `validation_kind ∈ {agent_runnable, surrogate, user_only}` tag on Step's `validation` field. Surrogate Steps require a checklist of substitute checks before passing. | framework | (pending §7) |
| L007 | decision | Numeric quality-gate targets (e.g. "≥5/9 lift" in S2.4 handoff) tempted gate-meeting via demoting an alternate to primary (D-004 Part D explicitly resisted). | Targets stated as exit-gates rather than stretch-goals invite goodharting. | Distinguish `target_stretch` vs `target_exit` in handoff packets. Default = stretch unless spec AC pins it. | framework | (pending §7) |
| L008 | tooling | Dual source-of-truth for stale thresholds (Python `cross_source_diff.py` + JS `STALE_THRESHOLDS_DAYS` constant). | Implementation seam between offline scan and live UI didn't have a shared schema file. | Either (a) JS imports the Python-emitted JSON's threshold map at runtime, or (b) emit a `thresholds.json` and have both sides read it. Today's duplicated constants are a latent drift trap. | project | (pending §7) |
| L009 | process | Retrospective annotations inside `decisions.md` duplicate fields with `lessons.md`'s outcome column. | Two parallel ledgers grown from the same template. | Make one canonical: either drop the `decisions.md` "Retrospective Annotations" table and only keep `lessons.md` §1, or treat `decisions.md` as the source-of-truth and have `lessons.md` reference back by ID without re-stating outcomes. | framework | (pending §7) |
| L010 | decision | gov_mmf -0.97 cross-source correlation ("right magnitude, wrong sign") would have been silently flagged "wrong" by a naive |corr|>X gate. | Validation gates that don't account for theory-direction force false rejections of correct economic relationships. | Empirical-validation rules should be expressed as `(theory_sign, |corr|_min)` tuples, not `corr_min` scalars. The harness should write both `corr` and `theory_consistent ∈ {match, substitute, mismatch}`. | project | (pending §7) |
| L011 | process | Path B drift was caught only because S4.2 happened to run `git status` as part of its visual-regression routine. | Mid-Phase drift detection has no scheduled cadence; relies on Step-author discipline. | At least at Phase boundary entry, run `git status` + `git diff --stat` against the last `state.md`-recorded baseline; surface untracked/uncommitted edits to user before continuing. | framework | (pending §7) |

## 7. Rollback Authorization (User Node ⑥)

> Filled **only** after the user explicitly approves each `framework`-scoped lesson for manual rollback into `~/dev/ief-core/framework_lessons.md`. Per `retrospective.md` Step 8, the actual rollback edit is **never automated**.

Awaiting User Node ⑥. Candidates for approval (framework-scoped only; project-scoped are out of scope for rollback):

- L003 (estimation tier promotion for rerun Steps)
- L004 (sub-numbering for scope-amend D-class)
- L005 (bootstrap invariant sanity-check)
- L006 (validation_kind tagging for agent-environment gaps)
- L007 (target_stretch vs target_exit in handoff)
- L009 (canonicalize retrospective ledger)
- L011 (git status at Phase boundary entry)

User Node ⑥ — recorded 2026-04-27. User verbatim: "Approve L003, L004, L005, L006, L007, L009, L011".

| L-ID | Approved (Y/N) | Approval Date |
|---|---|---|
| L003 | Y | 2026-04-27 |
| L004 | Y | 2026-04-27 |
| L005 | Y | 2026-04-27 |
| L006 | Y | 2026-04-27 |
| L007 | Y | 2026-04-27 |
| L009 | Y | 2026-04-27 |
| L011 | Y | 2026-04-27 |

**Outcome scores**: user did not override; §1 defaults stand as recorded.

**Rollback handling**: per `retrospective.md` Step 8 and the `/ief-retro` hard rule, the actual edits to `~/dev/ief-core/framework_lessons.md`, `~/dev/ief-core/VERSION`, and `~/dev/ief-core/CHANGELOG.md` are **deferred to a separate, out-of-band turn under explicit user instruction**. They are not performed in this retrospective session.
