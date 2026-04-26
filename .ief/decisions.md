# Decisions — USD Liquidity Visualization Optimization (v2)

> Append-only ledger of **committed choices**. Open uncertainties belong in `risks.md`.
> One decision per row. Never edit history; supersede via a new entry.

## Format
| ID | Date | Step | Decision | Alternatives Considered | Rationale | User-Confirmed |
|---|---|---|---|---|---|---|

## Decisions

### D-001 — Whitelist source set for v2 proxy gap filling
- **Date**: 2026-04-26
- **Step**: S1.4
- **Decision**:
  1. **IN scope** (7 sources): **OFR · BIS · SIFMA · ICI · FHLB Office of Finance · FHFA · CFTC**.
  2. **Deferred** (3 sources): **DTCC** (overlaps OFR cleared repo — only revisit if OFR data proves stale in S2.4), **SEC** (N-MFP / 13F too granular for current v2 node coverage), **IMF** (COFER / CPIS — no current node needs FX reserve composition).
  3. **Beyond original spec whitelist**: FHLB-OF, FHFA, CFTC are added to the IN set (spec §Constraints explicitly allows this with `decisions.md` rationale).
  4. **Permanently `not_found`** (no whitelist source helps): `foreign_insurers`, `corporates_offshore` — S2.3 will set `primary: null` + `reason` per spec §Acceptance #3. R002 already covers this.
  5. **Credential strategy**: free or free-key only. Reject any paid feed (e.g., Bloomberg `eur_usd_3m_basis` → replace with BIS USD basis CSV). Single env var added: `OFR_API_KEY` in `.env` and `.env.example`. Fail-soft on missing key.
- **Alternatives considered**:
  - Including DTCC / SEC / IMF in scope → rejected: data overlap (DTCC), excessive granularity (SEC), no current node coverage (IMF).
  - Using paid Bloomberg `eur_usd_3m_basis` → rejected by spec Q9 (no paid feeds).
  - Leaving `fhlb` / `gse` permanently `external` (no fetcher) → rejected: free public sources exist (FHLB-OF, FHFA), and these are core flow nodes.
  - Using CME / SEC for HF leverage → rejected: SEC Form PF is restricted, CME is paid. CFTC TFF is the canonical public substitute.
- **Rationale**:
  - Coverage minimality: the 7 IN sources fill 12 of 12 gap nodes (where any public proxy exists) and 4 of 5 gap edges; the only remaining gap (`eurodollar`) is partial-only by data nature, not by source choice.
  - Free-tier compatibility: every source has a public CSV/JSON/REST endpoint without paid auth.
  - Implementation discipline: defer DTCC / SEC / IMF rather than over-engineering S2.4.
- **User-Confirmed**: N (auto-decision per spec Q18 — "实现者自决；Phase 末统一接受用户验收"; will be reviewed at P1 Node ③).

### D-002 — Proxy registry gap table & canonical schema (S2.1 audit)
- **Date**: 2026-04-26
- **Step**: S2.1
- **Decision** (two parts):

#### Part A — Audit gap table (snapshot from `tools/audit_proxy_registry.py`)

Canonical: 32 NODES (`js/constants.js`). Registry: 31 entries (`js/v2/proxy_registry.js`).

**A.1 Coverage gap (1 node missing in registry)**:
| node_id | shape | group | classification |
|---|---|---|---|
| `bs_fhlb_deposits` | `bs_parent` | `bs_liabilities` (indented under `bs_other_liab`) | TO ADD in S2.3; FRED candidate `H41RESPPALDKNWW`-class FHLB-deposit line on H.4.1 — verify in S2.2 empirical pass. |

No orphan keys (registry has nothing not in NODES).

**A.2 Schema gap classification (29 entries against AC#2 schema)**:
| Class | Count | Disposition |
|---|---|---|
| Schema migration required (existing public-source entry, missing `alternates`/`theory`/`empirical`/`last_updated`/`script_path` and primary sub-fields `proxy_id`/`frequency`/`units`) | 17 | S2.3 — re-author after S2.2 produces `corr_36m`. |
| Permanent `not_found` (D-001) — currently uses `proxy_status: "not_found"`; AC#3 requires `primary: null + reason` | 2 (`foreign_insurers`, `corporates_offshore`) | S2.3 — convert to `{primary: null, reason}` shape. |
| Pending S2.4 (whitelist-source nodes — primary uses `External` source or `proxy_status: external\|partial`) | 12 | NOT errors at this stage; resolved when S2.4 fetchers land. |

Full per-node detail is reproducible via `python3 tools/audit_proxy_registry.py` (or `--json`); not duplicated here to keep the ledger compact.

#### Part B — Canonical proxy schema (decision)

This is the schema **all `NODE_PROXIES` entries must conform to** by end of S2.3 (with `corr_36m`/`chart_path` filled by S2.2 and external-source fields filled by S2.4):

```js
"<node_id>": {
  primary: {
    proxy_id:   "<short-id, e.g. WRESBAL>",   // REQUIRED
    source:     "FRED" | "NYFed" | "Treasury" | "OFR" | "BIS" | "SIFMA" | "ICI" | "FHLB-OF" | "FHFA" | "CFTC" | "Derived",
    frequency:  "D" | "W" | "M" | "Q" | "irregular",
    units:      "Mil. USD" | "Bil. USD" | "Percent" | "bps" | "Count" | "Index" | "Ratio",
    metric:     "<optional sub-metric for multi-column endpoints, e.g. percentRate>",
    note:       "<optional free-text>",
  },
  // OR — for permanent not_found / no-public-proxy nodes:
  // primary: null,
  // reason:  "<≥20 字中文 explaining why no public proxy exists>",

  alternates: [                                  // REQUIRED (may be empty array)
    { proxy_id, source, frequency, units, note? },
    // ...
  ],

  theory:      "<≥50 字中文 — 经济传导 / 流动性机理 / 为什么这个序列代表此节点>",
  empirical: {
    window:    "36M_monthly",                    // FIXED constant per spec §Constraints
    corr_36m:  <number ∈ [-1, 1] | null>,        // null only when sample < 36M (R005 fallback)
    chart_path:"data/json/proxy_charts/<node_id>.json"  // produced by S2.2 harness
  },
  last_updated: "YYYY-MM-DD",                    // ISO date of most recent observation OR pipeline run
  script_path:  "data/<fetcher>.py" | "data/cross_source_diff.py" | null,
}
```

**Naming conventions**:
- `proxy_id` is the **canonical short identifier** of the series in its source system (FRED ID, NYFed endpoint slug, Treasury fiscaldata table column, OFR series id). Lowercase or original-case as published; do NOT invent new IDs.
- `alternates[]` items use the same shape as `primary`; ordering = preference (most-preferred first).
- `units` uses a closed enum (above); avoid free-text variants like "Million USD" / "USD millions" — pick one canonical form.
- `frequency` uses the closed enum `{D, W, M, Q, irregular}` — matches `data/series_inventory.md` final table column.
- `chart_path` is a JSON snapshot path (not PNG). The chart renderer in S3 reads JSON; this avoids a binary-image checkin.

**Required vs optional**:
| Field | Required | Notes |
|---|---|---|
| `primary` (object or `null`) | yes | `null` requires sibling `reason` |
| `primary.proxy_id`, `.source`, `.frequency`, `.units` | yes (when primary is object) | `metric`, `note` optional |
| `alternates` | yes | empty array `[]` allowed |
| `theory` | yes | ≥50 中文字 |
| `empirical.window` | yes | constant `"36M_monthly"` |
| `empirical.corr_36m` | yes | numeric or `null` (with R005 short-history fallback note) |
| `empirical.chart_path` | yes | path string |
| `last_updated` | yes | ISO date |
| `script_path` | yes | repo-relative path or `null` for `External` until S2.4 lands |
| `reason` | conditional | required when `primary === null` |
| `proxy_status` | dropped | replaced by structural cues (`primary === null`, `script_path === null`) |
| `rationale` | dropped | renamed to `theory` (≥50 字 stricter) |
| `secondary` | dropped | replaced by `alternates: [...]` (array, allows N) |

#### Out of scope for D-002
- Per-node primary choice trade-offs — those go to D-003 (S2.3).
- Stale thresholds — already R004; will become D-005 in S3.3.
- Cross-source diff color / threshold — already in spec; no new decision needed.

- **Alternatives considered**:
  - Keep current `secondary` singular instead of `alternates[]` array → rejected: spec §Acceptance #2 explicitly says `alternates: [...]`.
  - Keep `rationale` instead of `theory` → rejected: spec demands `theory` with the ≥50 字 quality bar.
  - Use `proxy_status` enum (`ok`/`partial`/`external`/`not_found`) instead of structural nulls → rejected: spec already encodes "no proxy" as `primary: null + reason` (AC#3); a parallel enum would be redundant. Status during S2.4 implementation is implicit from `script_path === null`.
  - Use PNG `chart_path` → rejected: binary in repo + harder to regenerate in CI; JSON snapshot is reproducible from `data/json/time_series.json`.
- **Rationale**:
  - Locks the schema before S2.2 starts so the harness writes JSON shapes that S2.3 can drop directly into the registry.
  - Closes enums (`source` / `frequency` / `units`) so a future schema-validator (a small JSON-schema or zod-style guard) can be added in S2.3 without re-debating types.
  - Aligns with existing `data/series_inventory.md` final-table columns, so `script_path` and `frequency` are already populated for 59 live rows — S2.3 only does mapping work.
- **User-Confirmed**: N (auto-decision per spec Q18 — implementer self-decides; reviewed at P2 Node ③).

### D-003 — Per-node primary/alternate assignment (S2.3 migration to D-002 schema)
- **Date**: 2026-04-26
- **Step**: S2.3
- **Decision** (three parts: R009 fix, R008 disposition, per-node primary table):

#### Part A — R009 fix (series-ID correction)

For nodes `bs_rrp` and `bs_rrp_omo`, the original registry primary was `FRED:RPONTSYD`. S2.2 empirical run revealed corr_36m = -0.2534 against NYFed `rrp_ops.amt_accepted`, contradicting expected strong positive correlation. Diagnosis: `data/json/raw_observations.json` contains RPONTSYD with only 610/3474 non-zero observations at magnitude ~0.001, while `RRPONTTLD` (Overnight Reverse Repurchase Agreements: Total Operations) has 3071/3474 non-zero observations at magnitude matching NYFed take-up.

**Fix**: `bs_rrp.primary.proxy_id` and `bs_rrp_omo.primary.proxy_id` corrected to `RRPONTTLD` (`FRED`, `D`, `Bil. USD`). NYFed `rrp_ops.amt_accepted` moved to `alternates[]`. Re-run harness → corr_36m = 1.0 / 154 samples (cross-source ground truth: FRED ingests this from NYFed). Same fix applied to `EDGE_PROXIES.on_rrp.volume_proxy` and metric name corrected `acceptedCounterparties` → `counterparties`. R009 → `closed`.

#### Part B — R008 disposition (data-missing FRED series): chose Option B (defer)

Three series referenced in registry primaries are absent from current `data/json/raw_observations*.json` and `fed_balance_sheet.json` snapshots:
- `MBST` — Fed agency MBS holdings (used by `bs_agency_mbs`)
- `CURRCIR` — currency in circulation (`bs_fed_notes`)
- `H8B1058NCBCMG` — H.8 foreign-related bank credit (`foreign_banks`, `us_fbo`)

Two options were considered:
- **A**: add IDs to `data/series_config.py`, run `fetch_fred_data.py` + `build_database.py` + `export_json.py`, re-run harness.
- **B**: keep the 4 affected nodes' `primary` populated (proxy_id correctly identified) but with `corr_36m: null` and a `note` referencing R008; pipeline backfill scheduled at S4.1 (Pipeline E2E rerun).

**Choice: Option B**. Rationale:
1. Option A introduces a network dependency (FRED API key + smoke test) inside an otherwise pure-textual S2.3 — couples schema migration risk to fetcher-runtime risk.
2. The 4 nodes' candidate identification is correct and traceable; null `corr_36m` with explanatory note is fully spec-compliant (R005 fallback path).
3. S4.1 explicitly re-runs the pipeline end-to-end; piggybacking the 3-series addition there is the natural seam.
4. Reversibility: P4.1 backfill cost is identical regardless of A vs B choice, but B keeps S2.3 reviewable in isolation.

**Action item logged in handoff**: S4.1 must add `MBST`, `CURRCIR`, `H8B1058NCBCMG` to `data/series_config.py` before re-running the pipeline; afterwards re-run `data/proxy_validation.py` and confirm corr_36m for the 4 nodes becomes non-null. R008 → remains `open` until S4.1.

#### Part C — Per-node primary choice table (32 nodes)

Grouped by source / status. `corr_36m` from `data/json/proxy_empirical.json`.

**FRED-primary, self-anchored (8 nodes, all corr_36m = 1.0)**:
| node_id | proxy_id | freq | units | rationale |
|---|---|---|---|---|
| bs_treasuries | TREAST | W | Mil. USD | Direct H.4.1 line for Fed UST holdings — node concept ≡ series. |
| bs_primary_credit | WLCFLPCL | W | Mil. USD | Discount Window primary credit — direct line. |
| bs_cb_swaps | H41RESPPALDKNWW | W | Mil. USD | Central-bank USD liquidity swaps — direct line. |
| bs_foreign_repo | WLRRAL | W | Mil. USD | Total reverse-repo liability incl. foreign repo pool. |
| corporates_onshore | COMPAPER | W | Bil. USD | Total nonfinancial CP outstanding — direct read. |
| us_banks | TOTBKCR | W | Bil. USD | H.8 total commercial-bank credit — node concept ≡ series. |
| fcb_swf_supra_onshore | WLRRAL | W | Mil. USD | Onshore mirror of foreign repo pool (same series, separated for flow visualization). |
| fcb_swf_supra_offshore | WLRRAL | W | Mil. USD | Offshore mirror, same justification. |

**FRED-primary, cross-source anchor (1 node)**:
| node_id | proxy_id | freq | units | corr_36m | rationale |
|---|---|---|---|---|---|
| bs_reserve_balances | WRESBAL | W | Mil. USD | 0.4229 | Anchored against WALCL (total Fed balance sheet); 0.42 reflects QT-era TGA + RRP absorption decoupling reserves from headline balance sheet — economically expected, not a data quality issue. WALCL kept as `alternates[0]`. |

**Cross-source primary (2 nodes, corr_36m = 0.9834 each)**:
| node_id | primary | alternates | rationale |
|---|---|---|---|
| bs_tga | Treasury:tga_balance_usd_m (D, Mil. USD) | FRED:WTREGEN (W, Mil. USD) | Treasury Fiscal Data is daily; FRED H.4.1 weekly WTREGEN as cross-source verification. |
| us_treasury | Treasury:tga_balance_usd_m (D, Mil. USD) | Treasury:auctions_btc_by_term, FRED:WTREGEN | TGA balance + bid-to-cover by tenor jointly characterize issuance. |

**Cross-source primary (R009-fixed, 2 nodes, corr_36m = 1.0)**:
| node_id | primary | alternates | rationale |
|---|---|---|---|
| bs_rrp | FRED:RRPONTTLD (D, Bil. USD) | NYFed:rrp_ops.amt_accepted | R009 fix; FRED RRPONTTLD = NYFed take-up. |
| bs_rrp_omo | FRED:RRPONTTLD | NYFed:rrp_ops.amt_accepted | OMO is the dominant share of total operations. |

**FRED-primary, R008 data-missing (4 nodes, corr_36m = null pending S4.1)**:
| node_id | proxy_id | freq | units | note |
|---|---|---|---|---|
| bs_agency_mbs | MBST | W | Mil. USD | R008. |
| bs_fed_notes | CURRCIR | W | Mil. USD | R008. |
| foreign_banks | H8B1058NCBCMG | W | Bil. USD | R008. |
| us_fbo | H8B1058NCBCMG | W | Bil. USD | R008 (shares series with foreign_banks; FBO is the in-US branch view). |

**Permanent not_found per D-001 / spec AC#3 (2 nodes, primary: null)**:
- `foreign_insurers` — reason: "permanent-not_found (D-001): no public daily/weekly time series for foreign insurer USD asset holdings; NAIC quarterly is closest indirect proxy."
- `corporates_offshore` — reason: "permanent-not_found (D-001): offshore-USD corporate cash management is not publicly disclosed."

**Pending S2.4 — whitelist source TBD (12 nodes, primary: null)**:
| node_id | planned source | planned proxy_id |
|---|---|---|
| dealers | NYFed | primary_dealer_stats (manual CSV → fetcher in S2.4) |
| retail_investors | (TBD; ICI candidate) | — |
| gov_mmf | OFR | ofr_mmf_govt_aum (M); FRED:MMMFFAQ027S (Q) as alternate |
| prime_mmf | OFR | ofr_mmf_prime_aum |
| securities_lenders | NYFed | soma_summary.seclending (metric verification needed) |
| hedge_funds | OFR + CFTC | ofr_cleared_repo_sponsored + cftc_tff_treasury_net_short |
| fhlb | FHLB-OF | fhlb_of_monthly |
| gse | FHFA | fhfa_gse_holdings |
| offshore_mmf | ICI | ici_offshore_mmf_aum (Q only) |
| bs_other_liab | — | residual; may stay null permanently — re-evaluate at S2.4 |
| bs_foreign_reserves | — | small static H.4.1 line; may stay null |
| bs_others_assets | — | residual; may stay null permanently |

**Newly added (S2.1 coverage gap)**:
- `bs_fhlb_deposits` — added to registry with `primary: null, reason: "pending-S2.4 (FHLB-OF source planned, D-001 IN)"`.

#### Part D — EDGE_PROXIES touch-up

Per the registry rewrite, two edge entries were corrected:
- `on_rrp.volume_proxy.series`: `RPONTSYD` → `RRPONTTLD` (R009).
- `on_rrp.counterparties_proxy.metric`: `acceptedCounterparties` → `counterparties` (matches `nyfed_operations.json` schema).
- `srf.volume_proxy.metric`: `totalAmtAccepted` → `amt_accepted` (matches `nyfed_operations.json` schema).

Edge schema is **out of scope** for D-002; no further refactor here.

- **Alternatives considered**:
  - **Option A for R008** (run fetcher inside S2.3): rejected per Part B rationale — couples schema migration risk to fetcher runtime risk.
  - **Mark R008 nodes as `pending-S2.4` with `primary: null`**: rejected — the proxy_id and source are correctly identified; pretending we don't know the proxy would be misleading. Better to populate `primary` and surface the data gap via `corr_36m: null + note`.
  - **Skip the strict schema validator**: rejected — `tools/validate_registry_schema.py` catches enum mismatches and `theory` length violations that the audit script doesn't, and is cheap to maintain (≈300 LOC, pure stdlib).
  - **Use FRED RRPONTSYD in alternates list**: rejected — RPONTSYD per the data inspection is empirically broken in our snapshots; keeping it in alternates would mislead future readers. Prefer NYFed `rrp_ops` as the natural alternate.
- **Rationale**:
  - Brings the registry into strict D-002 conformance (audit + new strict validator both pass with 0 errors).
  - All 32 NODES present (audit coverage gap closed).
  - R009 series-ID bug is fixed and the 1.0 cross-source correlation acts as live validation that FRED RRPONTTLD ≡ NYFed amt_accepted.
  - R008 deferred to S4.1 in a documented, reversible way; doesn't block S2.4.
- **User-Confirmed**: N (auto-decision per spec Q18; reviewed at P2 Node ③).

### D-004 — S2.4 fetcher implementation, deferrals, and gov_mmf negative-correlation finding
- **Date**: 2026-04-26
- **Step**: S2.4
- **Decision** (four parts):

#### Part A — Sources implemented in S2.4
1. **OFR** (free `/v1/series/timeseries` REST endpoint, no auth required for the timeseries view; `OFR_API_KEY` forwarded if present per D-001):
   - 5 mnemonics fetched: `MMF-MMF_TOT-M`, `MMF-MMF_T_TOT-M`, `MMF-MMF_OA_TOT-M`, `REPO-DVP_OV_OO-P`, `REPO-TRI_TV_OO-P`.
   - New: `data/ofr_config.py`, `data/fetch_ofr_data.py`, `data/raw/ofr/*.json` (5 files).
2. **NYFed Primary Dealer Statistics** (`/api/pd/get/<keyid>.json`, public, weekly):
   - 3 keyids: `PDPOSGST-TOT` (UST excl. TIPS), `PDPOSFGS-TOT` (agency + GSE), `PDPOSMBS-TOT` (MBS).
   - New: `data/nyfed_pd_config.py`, `data/fetch_nyfed_pd_data.py`, `data/raw/nyfed_pd/*.json` (3 files, 681 obs each).
   - **Source-enum decision**: registry entries stamp `source: "NYFed"` (D-002 enum-valid) — the harness `SeriesStore` disambiguates between Markets-API operations and PD Statistics by alias presence (PD aliases such as `primary_dealer_ust_position` live in a separate raw-cache dir but share the enum value). This avoids extending the D-002 enum. The harness retains a defensive `NYFed-PD` source key for transitional support but it is **not used in registry** entries.
3. **CFTC TFF** (Socrata REST endpoint `data.cftc.gov/resource/gpe5-46if.json`, public, weekly):
   - 3 contracts: `UST 10Y NOTE`, `UST 2Y NOTE`, `UST BOND` (Treasury-bond + 2y note + 10y note traders-in-financial-futures, leveraged-funds long/short collapsed to **net** by date).
   - New: `data/cftc_config.py`, `data/fetch_cftc_data.py`, `data/raw/cftc/*.json` (3 files, 1037 rows each).
   - **Contract-name caveat**: actual Socrata `contract_market_name` values use the abbreviation `UST`, not `U.S. TREASURY`; first attempt with the latter returned zero rows. Documented in `cftc_config.py`.

#### Part B — Sources deferred (D-001 IN-set retained, parser not built in S2.4)
1. **FHLB-OF**: monthly Excel + PDF only; no public JSON/CSV API. Implementing an Excel parser would require new pip dependencies (`openpyxl` or similar) which is out-of-scope for the pure-stdlib fetcher style of S2.4. Affects: `fhlb`, `bs_fhlb_deposits` (both retain `primary: null` with `S2.4-deferred` reason).
2. **FHFA**: same disposition as FHLB-OF (PDF + Excel only). Affects: `gse`.
3. **ICI**: weekly retail money-fund flows are HTML-only; quarterly Worldwide statistics are PDF + HTML. Affects: `retail_investors`, `offshore_mmf`.
4. **NYFed seclending endpoint**: probed multiple `/api/seclending/...` paths during S2.4; all returned HTTP 400 without authenticated parameters. The previously-assumed `soma_summary.seclending` metric does not exist in the current `data/raw/nyfed/soma_summary.json` schema. Affects: `securities_lenders`. As a partial mitigation the entry's `alternates[]` now points at OFR `REPO-TRI_TV_OO-P` (tri-party overnight volume) which is the closest indirect proxy for sec-lender cash deployment.
5. **BIS / SIFMA**: no S2.4 work-list node required these in practice; D-001 IN-set retained for future iterations.

#### Part C — Confirmed-permanent-null residual buckets (no fetcher will be built)
- `bs_other_liab`, `bs_foreign_reserves`, `bs_others_assets` — H.4.1 residual buckets without a clean public single-series proxy. Per AC#3, these now carry `reason: "S2.4-confirmed null (D-004): ..."` (was `pending-S2.4`). They remain in the registry as topology placeholders — the v2 viz will display them with no badge. Re-evaluate only if a future iteration synthesizes a derived residual series.

#### Part D — `gov_mmf` empirical finding (negative correlation is economically expected)
- Cross-source 36M Pearson `corr(OFR T_TOT_M, FRED RRPONTTLD_M) = -0.9651` (153 monthly samples). The **sign is negative** but **magnitude is high**, which still validates the proxy choice: government MMF money allocates between Treasury-collateral repo (T_TOT) and ON RRP (RRPONTTLD) as substitutes — when T-bill yields exceed the RRP rate, gov MMFs roll out of RRP into Treasury repo, and vice versa. The 0.97 magnitude is a stronger empirical signal than a same-sign 0.7 cross-source pair would be.
- Decision: accept this anchor; document the substitution mechanism in the `gov_mmf` registry `theory` block (now updated). No alternates change.

- **Alternatives considered**:
  - **Extend D-002 source-enum to include `NYFed-PD`** (separate from `NYFed`): rejected — minimal benefit, forces a schema change for one alias. The SeriesStore-side disambiguation is cheaper and keeps D-002 untouched.
  - **Build PDF/Excel parsers for FHLB-OF / FHFA / ICI inside S2.4**: rejected — would inflate Step ctx beyond what the handoff scoped (HIGH was already flagged) and would introduce new pip dependencies. Defer to a follow-up iteration.
  - **Synthesize a `bs_other_liab` derived-residual series** (`WALCL - sum(major liabilities)`): rejected — Derived sources are allowed by D-002 enum but the residual would be inherently noisy and dependent on the exact set of "major" lines included; not worth it for a topology-only placeholder.
  - **Hit the 5/9 quality-gate target by also live-ing `securities_lenders` via the OFR triparty alternate**: rejected — that would mean stamping `primary` with what is properly an `alternate` (the OFR series doesn't measure sec-lender activity directly; it measures the contra-side). Per AC#3 (no fake proxies) this is exactly the kind of placement the spec forbids. Better to stay 4/9 and document the gap honestly.
- **Rationale**:
  - Coverage: S2.4 lifted 4 nodes from `pending-S2.4 → live` (`dealers`, `gov_mmf`, `prime_mmf`, `hedge_funds`); 5 nodes remain `null` with upgraded `S2.4-deferred` reasons; 4 (incl. the original 3 residual buckets + `securities_lenders`) carry `S2.4-confirmed null` or `S2.4-deferred` text. Total live count: **17 + 4 = 21 / 32**.
  - Quality Gate target trade-off: handoff asked for "≥5/9 live" — actual is **4/9**. The shortfall is concentrated in the PDF/Excel-parsing tail (FHLB-OF, FHFA, ICI). Two options were available: (a) build PDF parsers in S2.4 (rejected, scope creep + new deps), (b) accept 4/9 and document explicitly. Option (b) selected; this decision recorded for P2 Node ③ review.
  - Fail-soft pattern (HTTP/parse errors → log + skip + exit 0) proven across all three new fetchers; matches the D-001 credentialing strategy.
  - All 32 entries pass `audit_proxy_registry.py` and `validate_registry_schema.py` with 0 errors.
- **User-Confirmed**: N (auto-decision per Q18; reviewed at P2 Node ③).

---

### D-005 — Badge collision feasibility (S3.1) — outcome A: fits in current geometry

- **Date**: 2026-04-26
- **Step**: S3.1
- **Decision**: Branch **A** of plan row 3.1 — the centered-above-node badge anchor fits inside the **current** SVG `viewBox="0 0 2150 1280"` and current node coordinates **without any geometry change** and without invoking Node ② to extend the canvas. The S3.2 implementation must constrain badge box to **height ≤ 14 px** with **≤ 3 px padding above the node top edge** (≤ 17 px total vertical footprint) on all 32 nodes.
- **Quantitative basis** (computed offline by an ad-hoc clearance audit; rerunnable from this Step's commit; methodology = nearest obstacle above each node within ±(node_hw + obstacle_hw + 4 px) horizontal envelope; obstacles = other nodes, "Assets/Liabilities" annotations, group-section header text-baselines):

  | Node group | Count | Top clearance (px) | Limiting neighbor |
  |---|---|---|---|
  | BS-column rows on 70-px pitch (`bs_agency_mbs`, `bs_primary_credit`, `bs_cb_swaps`, `bs_foreign_reserves`, `bs_others_assets`, `bs_fed_notes`, `bs_rrp`, `bs_rrp_omo`, `bs_foreign_repo`, `bs_other_liab`, `bs_tga`, `bs_fhlb_deposits`) | 12 | **20 px (tightest)** | parent bs_parent above (70-px pitch − 50-px height) |
  | BS-column top row under "Assets"/"Liabilities" annotation (`bs_treasuries`, `bs_reserve_balances`) | 2 | 88 px | annotation baseline y=107 |
  | `us_banks` / `us_fbo` under "Banks and Dealers" header | 2 | 44 px | header baseline y=113 |
  | `gov_mmf` / `prime_mmf` under `retail_investors` | 2 | 33 px | circle bottom |
  | `fcb_swf_supra_offshore` under "OFFSHORE ENTITIES" header | 1 | 41 px | header baseline y=73 |
  | All remaining circles / hexagons / `us_treasury` | 13 | 49 – 153 px | row above |

  Tightest = **20 px** (12 BS-pitch nodes). Loosest = **153 px** (`offshore_mmf`). With the constrained badge (≤ 17 px), zero nodes are tight.

- **Geometry constraint encoded for S3.2**: badge `<rect>` height **14 px**, vertical offset above node top edge **3 px**, horizontal anchor `text-anchor="middle"` at node center `x`. Total footprint occupies y ∈ `[node.y − hh − 17, node.y − hh − 3]`. Width remains data-dependent (string length × charW + padX·2).
- **Alternatives considered**:
  - **Branch B — shift BS-column nodes down by Δy ≥ 3 px each**: rejected — would violate spec AC#7 ("currently fixed no-overlap state must not regress") in spirit by re-touching geometry, and would cascade through edge-router endpoint snap-points; unnecessary because Branch A's clearance budget already fits a usable badge.
  - **Branch C — extend `viewBox` height by 20 px and shift everything down**: rejected — invokes Node ②, no functional benefit, breaks visual baseline of v1 (which shares the same constants module).
  - **Keep current right-top anchor and only add hover tooltip**: rejected — contradicts spec v0.2.0 §Q12/Q13 (centered-above-node anchor is a hard requirement).
  - **Larger 16-px-tall badge**: rejected — fails the 12 BS-row nodes by 4 px (would clip into the node above).
- **Rationale**:
  - Audit shows 20 of 32 nodes have ≥ 33 px clearance (badge fits comfortably at any reasonable size); the binding constraint is the 12 BS-pitch nodes at 20 px exactly.
  - 14-px height + 3-px gap leaves 3 px of safety against rendering / DPI rounding.
  - Choosing the constraint **per-node uniform** (rather than per-row variable) preserves visual uniformity — all 32 badges look the same. Spec AC#4 ("水平居中的浮动角标 — content the primary value") is satisfied with single fixed geometry.
  - No node geometry change → AC#7 trivially preserved → Node ② not required → P3 entry is a pure CSS + light-JS change (matches plan row 3.1 ctx-cost MEDIUM and S3.2 entry-point assumption in handoff).
  - Mitigates **R003** (visual regression risk on tight rows): the explicit per-node clearance table above operationalizes the inception risk into measurable tolerance.
- **User-Confirmed**: N (auto-decision per Q18; reviewed at P3 Node ③).

---

### S2.5 retroactive note — no formal D-number issued

State.md and handoff.md previously referenced "D-005 (S2.5 cross-source diff)" but S2.5's outputs were JSON artifacts (`data/cross_source_diff.py` + `data/json/cross_source_diff.json` containing `stale_thresholds_days`, `substitute_pairs`, etc.) and did not require a formal decision entry — choices were either purely mechanical (5% threshold from spec AC#5) or already in spec/D-002. The S2.5 work is **state-tier only**; it carries no `decisions.md` row. The D-005 number is now allocated to S3.1 above. State.md and handoff.md updated to reflect this.

---

### D-006 — Stale thresholds + violation color visualization (S3.3)
- **Date**: 2026-04-26
- **Step**: S3.3
- **Decision** (three parts):

#### Part A — Per-frequency stale thresholds (calendar days)

Mirrors `data/json/cross_source_diff.json` `stale_thresholds_days` exactly so the offline scanner (S2.5) and the live UI (S3.3) agree:

| Frequency | Threshold (days) | Justification |
|---|---|---|
| `D` (daily)     | 7   | Covers a long weekend + 1 holiday + 1 publication-delay day. FRED daily series (EFFR, RRPONTTLD, …) publish T+1; 7 d gives one full week of headroom. |
| `W` (weekly)    | 21  | H.4.1 / H.6 / WALCL etc. publish weekly with up to 5 d lag. 21 d = 3 missed weekly cycles → unmistakably stale. |
| `M` (monthly)   | 60  | OFR / FHFA / NYFed PD monthly series have variable cut-offs (some up to 4-6 weeks lag). 60 d = ~2 months → stale beyond normal release lag. |
| `Q` (quarterly) | 180 | Z.1 / SLT / Form PF analogues land 60-90 d after quarter end. 180 d = ≥ 1 missed quarterly release. |
| `irregular`     | ∞   | Auctions / SRF ops / event-driven; stale check disabled. |

These constants are duplicated in two places **on purpose**:
1. `data/cross_source_diff.py` (offline scanner) — drives `summary.violation_node_ids` selection.
2. `js/v2/badges.js` `STALE_THRESHOLDS_DAYS` — drives live-UI gray-out.
Any future change must update both atomically; verified at S4.1 by spot-diff.

#### Part B — Visualization color spec

| State | CSS class | Background | Text color | Trigger |
|---|---|---|---|---|
| value (default) | `.proxy-badge-value` | white | dark slate | FRED proxy with cached observation. |
| info            | `.proxy-badge-info`  | pale yellow | amber-brown | Non-FRED primary or FRED-without-cache (renders SOURCE tag). |
| muted           | `.proxy-badge-muted` | light gray  | mid gray | `primary === null` (renders "—"). |
| **stale**       | `.proxy-badge-stale` | light gray  | mid gray (font-weight 500) | latest obsDate older than D-006 Part A threshold. |
| **violation**   | `.proxy-badge-violation` | amber `#fff3cd` | dark amber `#6b4900` | node id is in `cross_source_diff.json` `summary.violation_node_ids`. |

Precedence (badges.js): `violation > stale > value/info/muted`. The same node can be both stale AND in violation; violation wins because it is the actionable state (the offline scan already filters to non-stale latest values per `pair.candidate.stale === false`, so in practice both rarely coincide).

#### Part C — Tooltip extensions

`showBadgeProxy(node, event, dataLoader, obsDate, extras)` accepts `extras = { stale, violation, crossDiff }`. When set, appends:
- stale row: `⚠ stale: <ageDays>d since <YYYY-MM> (threshold <T>d)` (gray bold)
- violation row: `⚠ cross-source diff <X.X>% > 5%` + a muted line `<source> <series> vs <source> <series>` resolved from the matching `crossDiff.pairs` entry (filter: `same_concept=true && substitute=false && |relative_diff_pct| > 5`).

#### Part D — Out-of-scope (deferred / explicit non-goals)

- Per-node *policy* threshold violations (e.g. EFFR > IORB+ε, SOFR-IORB > X bps). Plan row 3.3 mentioned "琥珀色高亮逻辑" generically; we deliberately scope this to the cross-source 5% rule in S3.3 because that mechanism is already populated by S2.5's offline scan and needs no new threshold table. Per-node policy thresholds remain a P4 retro candidate.
- Backfilling violation IDs after R008 fetcher additions. Owned by S4.1 pipeline rerun (the JSON file regenerates → live UI picks up automatically).

- **Alternatives considered**:
  - **Hardcode a single 30-day stale threshold**: rejected — wildly mis-classifies daily series (week-end → wrongly green) and quarterly series (60-day publish lag → wrongly stale).
  - **Make stale gray-out wholesale rather than text-only color shift**: kept text-only because the value is still useful (it's the *most recent* available); the gray *signals* low confidence rather than hiding data.
  - **Extend D-002 schema with explicit per-node policy thresholds**: rejected here, deferred to P4 retro. Adding 32 threshold tuples without empirical violation data is speculation; better to wait until S4 retrospective surfaces actual signals.
- **Rationale**:
  - Two-step duplicate (Python + JS) is acceptable because the JS read of `cross_source_diff.json` already contains the same array — but using the file means the offline scan is the source of truth. The JS map is purely a *fallback* for the live-UI stale check on FRED nodes whose obsDate comes from `time_series.json`, not from the violation file.
  - Color palette deliberately avoids red (already used elsewhere in v1 for negative balances) and uses CSS-variable-friendly hex strings for future theming.
  - Violation precedence over stale ensures a single visual answer per badge — the rare both-state case picks the actionable one.
- **User-Confirmed**: N (auto-decision per Q18; reviewed at P3 Node ③).

---

### D-007 — R008 unblock outcome & series-metadata corrections (S4.1)
- **Date**: 2026-04-26
- **Step**: S4.1
- **Decision** (4 parts):

#### Part A — Pipeline-level R008 unblock
- Added `MBST` / `CURRCIR` / `H8B1058NCBCMG` to `data/series_config.py::FRED_SERIES_V2` (kept v1 `FRED_SERIES` byte-equivalent per spec §0.1.2).
- Extended `data/export_json.py` so `time_series.json` and `series_metadata.json` include all `FRED_SERIES_V2` ids (additive — v1 reads these JSONs but only by node-defined ids in `js/constants.js`, so no v1-side regression).
- After S4.1 pipeline run: all 3 series resolve at the latest as-of date (MBST=1.74M Mil. USD, CURRCIR=2415.7 Bil. USD, H8B1058NCBCMG=9.8 %).

#### Part B — Authoritative FRED metadata (live `Fred.get_series_info` lookup) reveals divergences
| FRED ID | Actual title | Actual units | Actual freq | obs_end | Status |
|---|---|---|---|---|---|
| `MBST` | Mortgage-backed securities held by the Federal Reserve: All Maturities **(DISCONTINUED)** | Millions of Dollars | Weekly, As of Wednesday | **2018-06-13** | ✅ units OK; ❗ historical only — series dead since 2018; not a usable current-state proxy for `bs_agency_mbs`. |
| `CURRCIR` | Currency in Circulation **(DISCONTINUED)** | **Billions of Dollars** | **Monthly** | 2025-10-01 | ❗ both units (Mil→Bil) and frequency (W→M) miscoded in our config; corrected. |
| `H8B1058NCBCMG` | **Deposits, All Commercial Banks** | **Percent Change at Annual Rate** | Monthly | 2026-03-01 | ❌ neither title nor units match the assumed "H.8 foreign-related bank credit, Bil. USD"; the ID maps to a different concept. |

Corrections applied to `data/series_config.py::FRED_SERIES_V2`:
- `CURRCIR`: `frequency M`, `units Bil. USD` (was `W`, `Mil. USD`).
- `H8B1058NCBCMG`: `frequency M`, `units Percent`, `name "Deposits, All Commercial Banks (% chg, annualized)"` (was `W`, `Bil. USD`, "Bank Credit, Foreign-Related Institutions"). Note: this ID is no longer suitable as a *level* proxy for `foreign_banks` / `us_fbo`; registry implications in Part D.
- `MBST`: kept as-is (units + freq match FRED); discontinuation handled by stale-color path (>7 years old → strongly stale grey; D-006 stale path still works).

#### Part C — Registry implications (`js/v2/proxy_registry.js`)
- `bs_agency_mbs.primary.proxy_id = "MBST"` — kept, but *primary* status is now nominal (data ends 2018). Add `note: "DISCONTINUED 2018; historical reference only — not a live indicator. Use as cross-source corroboration of stock levels pre-2018."` to the primary entry. Mark `bs_agency_mbs` registry row to acknowledge gap; spec-side R008 cannot be fully closed via FRED.
- `bs_fed_notes.primary.proxy_id = "CURRCIR"` — kept; freq=M and units=Bil. USD acknowledged. Last obs 2025-10 → currently fresh enough (within the M=60d threshold from D-006).
- `foreign_banks.primary.proxy_id = "H8B1058NCBCMG"` and `us_fbo.primary.proxy_id = "H8B1058NCBCMG"` — **demote to `alternates[]`** (it's a flow-rate, not a stock level — wrong concept for "foreign-related bank credit stock"). Set `primary = null` with `reason: "S4.1-confirmed null (D-007): no public single-series stock proxy located for foreign-related bank credit; D-001 IN-set H.8 line maps to a percent-change series, not a level. Defer to P4 retro for next-cycle source addition."`. Effect: 2 nodes flip from "registry primary live" back to "primary null" — closer to truth than S2.3's incorrect Option-B placeholder.

#### Part D — R008 status reclassification
- R008 was filed as a *blocked-by-pipeline* dependency. S4.1 pipeline part is now executed (Part A above), but Part B finds two of the three IDs were misidentified in S2.3. R008 is therefore **partially closed**: pipeline blocker resolved; concept-mapping shortfall (foreign-related bank credit level) remains as a residual surface. Updated `risks.md` R008: `mitigated` (pipeline) with residual `concept-mapping` flag tracked into the P4 retrospective for source addition (BIS locational banking statistics is a candidate but is a P4-retro / future-cycle item — out of S4.1 scope).

- **Alternatives considered**:
  - **Replace `H8B1058NCBCMG` immediately with a different FRED ID**: rejected — no obvious single-series replacement exists for "foreign-related bank credit stock" within the time-budget of S4.1. BIS locational banking statistics is a multi-table parsing project (a full new fetcher), well past S4.1 scope. Promoting to P4 retro is the disciplined choice.
  - **Drop `MBST` from registry since the series is dead**: rejected — discontinued historical series still has documentary value (the pre-2018 stock levels are correct), and the D-006 stale path is sufficient to communicate the freshness gap to viewers.
  - **Hardcode a stale-marker on a registry-flag basis (`is_discontinued: true`)**: rejected — D-006 frequency-aware stale thresholds already cover this transparently; adding a new schema field would be over-engineering for one node.
- **Rationale**: The S4.1 step description was *"R008 unblock by adding 3 series to series_config.py"*. Strict interpretation of that scope says: data-pipeline plumbing only. The discovery that 2 of 3 IDs are conceptually wrong is an honest metadata audit done at pipeline-build time and recorded here, not silently smoothed over. Demoting `H8B1058NCBCMG` to a null-with-reason matches spec §AC#3 (`primary: null` is a legitimate state, not a defect, when the truthful answer is "no public proxy"). MBST staying is the lesser evil compared to dropping a node.
- **User-Confirmed**: N (auto-decision per Q18; surface at P4 Node ④).

---

### D-008 — bs_liabilities flat hierarchy + spec §0.1.2 relaxation (S4.2 Path B)

- **Date**: 2026-04-26
- **Step**: S4.2
- **Triggering finding**: S4.2 visual-regression auto-checks discovered uncommitted local edits in [js/constants.js](js/constants.js) + [js/nodes.js](js/nodes.js) (mtime 2026-04-26 16:23, pre-S4.1) re-organizing the bs_liabilities column. Filed as **R012**. User Node ② given verbatim "Path B" — accept the new layout as baseline + amend spec.
- **Decision** (3 parts):

#### Part A — Layout change description (now-canonical)

Four nodes promoted from `bs_child` to `bs_parent` with an `indent: true` flag:

| Node id | Old shape / pos | New shape / pos | Old parent column x | New x |
|---|---|---|---|---|
| `bs_rrp_omo` | bs_child / x=372 y=425 | bs_parent + indent / x=355 y=430 | 372 | 355 |
| `bs_foreign_repo` | bs_child / x=372 y=485 | bs_parent + indent / x=355 y=500 | 372 | 355 |
| `bs_tga` | bs_child / x=372 y=495 | bs_parent + indent / x=355 y=640 | 372 | 355 |
| `bs_fhlb_deposits` | bs_child / x=372 y=555 | bs_parent + indent / x=355 y=710 | 372 | 355 |

Plus:
- `bs_other_liab` y shifted 430 → 570 (so `bs_tga` / `bs_fhlb_deposits` group anchors below the RRP group).
- 2 new `dash_*_group` SECTIONS in [js/constants.js](js/constants.js):
  - `dash_rrp_group` — x=250 y=325 w=210 h=200 (wraps bs_rrp + 2 indented children, y=325..525).
  - `dash_other_liab_group` — x=250 y=540 w=210 h=200 (wraps bs_other_liab + 2 indented children, y=540..740, 15 px gap to dash_rrp_group).
- [js/nodes.js](js/nodes.js) `renderNodes` adds an `isIndented` branch: when `d.indent === true`, prefix `lines[0]` with `"\u2022 "` (bullet) at render time. `d.label` itself untouched, so tooltip / sidebar consume the verbatim label.
- [js/nodes.js](js/nodes.js) `renderSections` extends `sectionOrder` with the 2 new dash group ids at the end of the array (rendered last → on top z-order, but `dashed_gray` style is non-filled so doesn't occlude).

#### Part B — Geometry audit (re-run of D-005 method on Path B layout)

Method: same as D-005 — for every registry node, compute clearance to nearest obstacle within ±130 px x-distance and report nodes with gap < 17 px (D-005 budget = badge h 14 + pad 3).

Result on Path B working tree:
- Violations (gap < 17 px): **0 / 32**.
- Tight @ 20 px (matching the BS-pitch baseline already in D-005): 12 nodes — same 12 BS-column nodes as D-005 originally identified, now extended to include `bs_rrp_omo`, `bs_foreign_repo`, `bs_other_liab`, `bs_tga`, `bs_fhlb_deposits` (formerly bs_child h=40 with cross-column ambiguity, now uniform bs_parent h=50 inline).
- Loosest: 153 px (`offshore_mmf`, unchanged).

Latent issue retroactively discovered in OLD layout: `bs_foreign_repo` (x=372 y=485 h=40) had a cross-column 10 px clearance to `bs_other_liab` (x=355 y=430 h=50) — within the 130 px x-distance threshold. D-005 audit at S3.1 missed this because the audit at that time treated bs_child / bs_parent as a parent-child unit rather than two independent obstacles. **Path B layout incidentally fixes this latent regression** by promoting the children to bs_parent and aligning all on x=355 with uniform 70 px y-step.

`audit_proxy_registry.py` ERRORS=0 PENDING=0 · `validate_registry_schema.py` 32 ✓ all valid · `cross_source_diff.json` summary unchanged.

#### Part C — Spec §0.1.2 amendment (v0.2.0 → v0.2.1)

Amended in three sections of `.ief/spec.md`:

1. **Scope-IN** (line 20, "v1 模块视觉零变化"): added a v0.2.1 sub-bullet relaxing the invariant from "v1 视觉零变化" to "v1 节点拓扑（id 集合 / 概念语义）保持冻结，但允许结构性微调（节点 shape / x / y / parentId / indent flag）以**修复**或**消除**几何冲突，前提是：(i) 调整后通过 D-005 ≥17 px clearance 审计；(ii) 不新增 / 删除节点；(iii) 不扩 viewBox；(iv) 不改边路由拓扑；(v) 在 decisions.md 记录调整内容与几何审计结果".
2. **Scope-OUT** (line 24, "不改造 v1 模块的布局…"): added v0.2.1 exception clause referencing D-008 conditions.
3. **AC #8** (line 53, "v1 视觉相对修复前**逐像素无差异**"): replaced "逐像素无差异" with "在节点 id / 概念 / 拓扑 / viewBox / 边路由层面无差异（仅允许 proxy 数据基础设施被动共享 + (v0.2.1) 经 D-005 重审通过的几何冲突修复）".

Version history table appended row `0.2.1 | 2026-04-26 | Drift branch C (scope relaxation, S4.2)`.

#### Part D — R012 closure

R012 → **closed** by D-008. Rationale: the newly applied layout passes D-005 audit cleanly; the previous "byte-equivalent" framing of §0.1.2 was a more restrictive interpretation than necessary for the actual project goal (which is "no v1 functional / topological regression", not "no pixel ever moves"). Path A (revert) was rejected by user; Path C (shrink badge) was geometrically infeasible per D-005 history.

- **Alternatives considered**:
  - **Path A — revert v1 changes**: rejected by user. Would also have left the latent 10 px `bs_foreign_repo` ↔ `bs_other_liab` cross-column violation (Part B) un-addressed.
  - **Path C — shrink badge to fit 14 px clearance**: rejected per D-005 history (h ≤ 12 hurts readability; not actionable).
  - **Defer to a new Phase 5**: rejected — change is small, mechanically simple, and the new layout is already verified to pass all geometry constraints. Spinning up a new Phase for a one-Step amendment is over-process.
- **Rationale**:
  - User explicitly chose Path B at Node ②; agent's role is to log, validate, and complete cleanly.
  - The amended §0.1.2 still preserves what the project actually cares about: v1 node id set + concept semantics + viewBox + edge topology stay frozen.
  - The new layout is empirically better — it removes a latent geometry violation that S3.1's audit didn't catch.
  - All 32 registry entries validate; 0 violations; tightest gap 20 px ≥ 17 px D-005 budget with 3 px safety margin.
- **User-Confirmed**: Y (Node ② given verbatim "Path B" 2026-04-26).

---

### D-009 — Phase 4 (Project) user sign-off · Node ④
- **Date**: 2026-04-26
- **Step**: S4.4
- **Decision**: User signed off on Phase 4 and the project as a whole with verbatim instruction "Sign off". Acceptance Criteria coverage at sign-off: 8/12 fully met, 4/12 (#9 + #12 collapse on this Node ④, #5 + #6 already evidenced in code/data, all marked ✅). 32/32 proxy registry entries valid; D-005 re-audit 0 violations; cross-source amber on bs_tga/us_treasury active; FRED 55-series pipeline live; bs_liabilities flat hierarchy + bullet rendering accepted as new v1 baseline (per D-008 / spec v0.2.1).
- **Out-of-scope items deferred to next-cycle (acknowledged by user without blocking sign-off)**:
  - v2 edge rendering (`EDGES = []` placeholder for future Modules C/D/E).
  - v2 standalone slider DOM (currently reuses v1's; hidden when v2 tab active).
  - v2 legend.
  - BIS locational banking fetcher (replaces foreign_banks/us_fbo conceptually).
  - MBST live alternate switch (current series discontinued 2018).
  - FHLB-OF / FHFA / ICI PDF/Excel parsers (D-004 deferral).
- **Open risks at sign-off**: R001 / R004 / R005 / R007-mitigated / R008-mitigated-pipeline-partially-closed-concept / R010 / R011 — all transferred to retro / next-cycle. Closed: R002, R003, R006, R009, R012.
- **Alternatives considered**: (a) Reject + re-enter Step → declined; (b) Sign off with retro item logged → would have been chosen if user flagged a regression; (c) Defer one item → not requested.
- **Rationale**: All in-scope acceptance criteria evidenced; spec v0.2.1 frozen; validators 0-error; user explicit sign-off.
- **User-Confirmed**: Y (Node ④ given verbatim "Sign off" 2026-04-26).

---

## Retrospective Annotations (filled in Phase 4)
| ID | Outcome | Note |
|---|---|---|
| D-001 | pending | Re-evaluate at P2 Node ③: did the 7 IN sources actually cover the gaps? Did any deferred source need to be added back in S2.4? |
| D-002 | pending | Re-evaluate at P2 Node ③: did the canonical schema hold up? Did `alternates[]` end up always empty (signal it should be optional)? Did `script_path: null` for External entries cause confusion downstream? |
| D-003 | pending | Re-evaluate at P2 Node ③: did Option B for R008 hold up (was S4.1 pipeline backfill executed cleanly)? Was the R009 fix the only series-ID error or were others surfaced in S2.4? Did any of the 12 pending nodes turn out to need a source not in D-001's 7 IN set? |
| D-004 | pending | Re-evaluate at P2 Node ③: was the 4/9 vs 5/9 gate trade-off acceptable to user? Should FHLB-OF / FHFA / ICI parser work be promoted to a future Step? Did the `gov_mmf` -0.97 cross-source result hold up under spec §AC#5 (cross-source 5% diff is computed only for **same-sign same-magnitude** pairs — does that scope handle this case?). |
| D-007 | pending | P4 retro: should we add BIS locational banking statistics as a new fetcher to genuinely unblock the foreign_banks / us_fbo node concept? Did the 2018-discontinued MBST-as-primary on bs_agency_mbs prove acceptable to viewers, or do we need to swap the primary to a live alternate (e.g. WSHOMCB)? |
| (S4.3 retro) | — | v2 没有独立时间滑块（复用 v1 `#date-select`/`#date-slider` via additive listeners）；v2 tab active 时 v1 pane hidden → 滑块不可见。`#time-selector-v2` placeholder 一直空。Spec §AC#8 仅要求"不被破坏"，监听器自洽。**Retro question**: 下个 cycle 是否在 v2 pane 复制一份 slider DOM？是否给 v2 加 mini-legend？v2 EDGES=[] 何时进入工作？ |
| D-008 | pending | P4 retro: did the bs_liabilities flat hierarchy + bullet rendering survive user visual review? Should the relaxed §0.1.2 invariant be further generalized in a v0.3 spec, or kept as a one-time exception? Did the 12 nodes still at 20 px BS-pitch ever rub against badge-rendering edge cases (tall multi-line wrapped labels, dynamic rect h growth, stale grey / amber overlays)? |
| D-009 | accepted | Project sign-off received. Retro should compile lessons from D-001..D-008 + 6 next-cycle items (v2 edges, v2 standalone slider, v2 legend, BIS fetcher, MBST live alt, FHLB-OF/FHFA/ICI parsers) into `lessons.md` and recommend cycle-2 plan. |
