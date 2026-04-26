# State — USD Liquidity Visualization Optimization (v2)

> Updated after every Step. Three tiers; load only what Prime needs.

## Tier 1 — Project Summary  (≤200 words)
为 USD Funding Flows 项目的 v2 模块新增「概念—代理变量—数值」三层一一对应的可视化能力：先梳理 FRED / Treasury / NY Fed 三大权威 API 中与美元流动性相关的时间序列产出 inventory；再为 v2 当前冻结节点清单匹配主+备 proxy（理论 + 36M 滚动相关系数验证）；然后保留 v2 既有的浮动角标机制，将其从节点右上角**重锚到节点正上方水平居中**，并为角标加上 hover tooltip（proxy 简写 + 观测 YYYY-MM）；v2 节点本体渲染不动，v1 视觉相对修复前在 id/概念/拓扑/viewBox/边路由层面无差异（spec v0.2.1 放宽 D-005 几何例外）。Spec **v0.2.1** 与 plan v0.1.0 冻结。**项目状态：COMPLETE 2026-04-26**：P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ (S4.1 pipeline rerun + R008 unblock D-007 / S4.2 Path B closure D-008 R012 closed / S4.3 console surrogate PASS / **S4.4 Node ④ "Sign off" D-009**)。32/32 registry valid · D-005 0 violations · cross-source amber active on bs_tga/us_treasury · 55-series FRED pipeline live。Open risks 全转 retro / next-cycle: R001/R004/R005/R007-mitigated/R008-mitigated-pipeline-partially-closed-concept/R010/R011。Closed: R002/R003/R006/R009/R012。下一步 `/ief-retro`（建议在新会话执行）。

## Tier 2 — Phase Summary  (≤500 words)
*Phase 4 (Integration & Acceptance) **DONE 4/4 Steps 2026-04-26**：S4.1 ✅ · S4.2 ✅ · S4.3 ✅ · S4.4 ✅ (Node ④ "Sign off")。Phase 4 退出条件 全 ✅：(I) 流水线 E2E rerun 完整跑通（55 series · 4 v2 JSON · audit/validate/proxy_validation 三 0 错）— S4.1 D-007 落决策。(II) v1 视觉验收：S4.2 Path B 接受 bs_liabilities flat hierarchy 为新 baseline；spec §0.1.2 放宽到 id/概念/拓扑/viewBox/边路由 invariant + D-005 重审通过的几何例外（spec v0.2.1）；D-008 + R012 closed。(III) 浏览器 console 验收：S4.3 静态 console-surrogate 0 expected error / 0 expected warning；user implicit accept v2 by-design omissions（无独立时间滑块、无 legend、EDGES=[]）；retro 表新增 1 行入 lessons.md draft。(IV) Node ④ 项目签收：S4.4 user verbatim "Sign off"；D-009 落决策（接受范围 + 6 项 next-cycle deferral + open risks transfer）；retro 表 D-009 outcome=accepted。Open risks 转入 retro / next-cycle owner: R001 / R004 / R005 / R007-mitigated / R008-mitigated-pipeline-partially-closed-concept / R010 / R011。Closed (5): R002 / R003 / R006 / R009 / R012。Spec 冻结于 v0.2.1。**项目状态：COMPLETE — awaiting `/ief-retro` (建议在新会话执行)**。

*Phase 4 (Integration & Acceptance) — historical S4.1 outcome (preserved for retro)：S4.1 outcome 三层：(I) 流水线层：FRED/NYFed/NYFed-PD/Treasury/OFR/CFTC 六 fetcher 全跑通；FRED v1=43 series + v2=12 series（MBST/CURRCIR/H8B1058NCBCMG 三个 R008 series 加入 FRED_SERIES_V2，spec §0.1.2 v1 byte-equivalent 通过保持 FRED_SERIES 不动来满足）；NYFed-PD 681 obs/series；OFR 5 endpoints；CFTC 1/3（2 路 SSL 抖动 fail-soft skip）。`build_database.py`：34962 v1 obs + 16891 v2 obs + 15769 treasury + 35954 nyfed + 5740 derived 全部入库。`export_json.py`：扩展为 `time_series.json` 与 `series_metadata.json` 现包含 FRED_SERIES_V2 全部 12 个 series（55 series total，55 metadata entries），v1 视觉不受影响（v1 仅按 js/constants.js 内 series id 检索）；4 个 v2-only JSON（fed_balance_sheet/treasury_flows/nyfed_operations/pressure_indicators）也重新生成。(II) 元数据审计层：live `Fred.get_series_info` 调用揭示 3 个 R008 series 的 metadata 与 S2.3 placeholder 不一致 — MBST 已于 2018-06-13 DISCONTINUED；CURRCIR 是 Monthly + Bil. USD（不是 W + Mil. USD）也已 DISCONTINUED 但仍发布到 2025-10；H8B1058NCBCMG 实际是 *Deposits, All Commercial Banks, % Change at Annual Rate*（不是 H.8 foreign-related credit level）。配置层修正：series_config.py 三行的 freq/units/name 改正。(III) registry 层：D-007 Part C 落实 — bs_agency_mbs / bs_fed_notes 保留 primary（FRED ID 实际可用，corr_36m=1.0/66 + 1.0/154）；foreign_banks / us_fbo 改回 `primary: null` + reason "S4.1-confirmed null (D-007 Part C)"（concept-mismatch — H8B1058NCBCMG 不是 stock series）；BIS locational banking statistics 作为 future-cycle 候选记入 D-007 retro 行。验证：audit_proxy_registry ERRORS=0 PENDING=0；validate_registry_schema ✓ all 32 valid；proxy_validation 30 charts re-emitted。R008 reclassified `mitigated (pipeline) / partially-closed (concept)`。

*Phase 3 (Layout Optimization & Floating Badge Re-anchor) **完成 4/4 Steps**：S3.1 ✅ · S3.2 ✅ · S3.3 ✅ · S3.4 ✅。Phase 3 → P4 transition: User Node ③ given 2026-04-26 ("Accept P3"). P4 首个 Step S4.1 在同会话续上。 P3 退出条件 5/5 覆盖：(1) badge 上方居中渲染 — D-005 + S3.2 实现；(2) hover tooltip 显示 proxy 简写 + observation YYYY-MM — S3.2 + S3.4；(3) stale 灰色 — S3.3 D-006；(4) cross-source 5% 错位琰珀色 — S3.3 D-006；(5) 数据流闭环 sidebar→badges — S3.4。**S3.4 产出**：(a) `js/v2/badges.js` 新增 `seriesValueAtOrBefore(dataLoader, seriesId, currentDate)` ——以 currentDate 为起点向后走找最近 ≤ currentDate 且非空的观测（spec AC#5）；badgeContent 优先调用该函数，currentDate=null 时 fallback 到 latestSeriesValue；(b) computeStaleness 加 referenceDate 参数，让 stale 阈值动态参考选中日期（拖到 2024 会看到 2024-as-of 的 stale 状态而不是 today-relative）；(c) `renderProxyBadges(layer, nodes, dataLoader, crossDiff, currentDate)` 加第 5 参；(d) `js/v2/diagram.js` 模块级 _ctx 容器 缓存 {badgeLayer, dataLoader, crossDiff, currentDate}；新导出 `updateBadges(currentDate)` 可重多次调；crossDiff 异步拿到后会以当前 currentDate 重渲染；(e) `js/v2/app.js` 在 initV2 中调 wireTimeSelector — 直接在 #date-select 听 change、在 #date-slider 听 input（50 ms debounce）后调 updateBadges；不动 v1 代码，只使用多听众共存。单元测试 4/4 走 case 通过（precise 、间隔回填、越下边界 null、越上边界取末位）。验证：badges/tooltip/value_format/diagram/app 5 个 v2 JS 文件 syntax OK；audit + validate 双 0 错。

*Phase 2 (Proxy Matching & Validation) 已完成 5/5 Steps：S2.1 (audit) · S2.2 (empirical harness) · S2.3 (primary/alternate assignment) · S2.4 (whitelist fetchers) · S2.5 (cross-source diff detection — 产出 `data/cross_source_diff.py` + `data/json/cross_source_diff.json`，state-tier only no-D-number)。S2.4 产出：(a) 3 新 fetcher 家族 + 3 配套 config（`data/{ofr,nyfed_pd,cftc}_config.py` + `data/fetch_{ofr,nyfed_pd,cftc}_data.py`）+ 11 个 raw JSON 缓存（`data/raw/{ofr,nyfed_pd,cftc}/*.json`）；(b) `data/proxy_validation.py` SeriesStore 扩 OFR/NYFed-PD/CFTC 三 source；新增基于 `primary: null` regex 的结构化 classify_registry；(c) `data/proxy_validation_anchors.json` 新增 4 行 anchor（dealers self / gov_mmf cross-source vs FRED RRPONTTLD / prime_mmf self / hedge_funds self）；(d) `js/v2/proxy_registry.js` 4 节点翻成 D-002 完整 entry，9 个残留 null 节点 reason 升级；(e) D-004 落决策（4 部分：sources implemented / sources deferred / permanent-null buckets / gov_mmf 负相关解读）；(f) R002 与 R006 标 mitigated。**Notable empirical**: gov_mmf 36M Pearson = **-0.9651**/153M（OFR T_TOT vs FRED RRPONTTLD），方向负向但量级高 — 经济上是 gov MMF 在 Treasury 抵押品回购与 ON RRP 之间的替代关系（高位收益率时离开 RRP 进入 T-repo），方向与原假设相反但有效证伪/证实了"二者紧耦合"。Quality Gate 命中 4/9 lift（handoff target 是 ≥5）；shortfall 集中在 PDF/Excel 解析尾巴（FHLB-OF/FHFA/ICI），D-004 显式记录该 trade-off 留 P2 Node ③ 复议。32/32 节点 audit + strict validator 双 0 错。下一步 **S2.5 — Cross-source diff detection**。
4.1 (Pipeline E2E rerun + R008 unblock) — DONE 2026-04-26:*
- 输入：handoff P3→P4 packet · `data/series_config.py` (FRED_SERIES + FRED_SERIES_V2) · `data/build_database.py` · `data/export_json.py` · 6 fetchers · `data/proxy_validation.py` · `tools/audit_proxy_registry.py` · `tools/validate_registry_schema.py` · `js/v2/proxy_registry.js` (S2.4/S3.x baseline)。
- 输出：
  - **`data/series_config.py`**：`FRED_SERIES_V2` 末尾追加 3 个 R008 unblock entry — `MBST` (W/Mil. USD)、`CURRCIR` (M/Bil. USD)、`H8B1058NCBCMG` (M/Percent)。后两者的 freq/units 是 S4.1 元数据审计后的真实 FRED 值（首版按 S2.3 placeholder 写错 W/Mil + W/Bil，多 replace 改正 + name 标 DISCONTINUED）。FRED_SERIES（v1）未触动 — spec §0.1.2 v1 byte-equivalent 守住。
  - **`data/export_json.py`**：3 处修改：(i) `from series_config import FRED_SERIES, FRED_SERIES_V2`；(ii) `all_series_ids` 改为 v1 keys + v2 keys（去重）；(iii) metadata 字典在 FRED_SERIES 之后追加 FRED_SERIES_V2 entries（`if sid in metadata: continue`）。结果：`time_series.json` 与 `series_metadata.json` 现含 55 个 series（v1 43 + v2 12）。v1 视觉不受影响 — v1 只按 `js/constants.js` 内 hardcoded id 查 metadata，不会读到这些新键。
  - **`js/v2/proxy_registry.js`**：4 处 multi-replace：
    - `bs_fed_notes.primary`：W/Mil → M/Bil + note 注 DISCONTINUED 但发布到 2025-10；empirical corr_36m null → 1.0/154。
    - `bs_agency_mbs.primary`：保留 W/Mil；note 注 2018-06-13 DISCONTINUED + 推迟 P4 retro 切换 live alternate；empirical null → 1.0/66。
    - `us_fbo.primary` & `foreign_banks.primary`：从 H8B1058NCBCMG/W/Bil 翻为 `null` + `reason: "S4.1-confirmed null (D-007 Part C): ..."`（concept-mismatch — FRED ID 是 % chg 不是 stock）。Theory 文本同步重写。empirical 保 null。script_path: null。
  - **`.ief/decisions.md`**：D-007（4 部分：A pipeline-level R008 unblock；B authoritative FRED metadata 审计 + corrections；C registry 影响；D R008 status reclassification）+ retrospective annotations 表新增 D-007 行。
  - **`.ief/risks.md`**：R008 status `open → mitigated (pipeline) / partially-closed (concept)`，描述追加 S4.1 outcome 段；linked decisions = D-003, D-007。
  - **数据 JSON 重生成**：`data/json/{time_series, series_metadata, available_dates, treasury_flows, fed_balance_sheet, nyfed_operations, pressure_indicators, proxy_empirical}.json` + `data/json/proxy_charts/*.json` (30) 全部 mtime 刷新。
- 验证：
  - `python3 data/fetch_fred_data.py` → v1 41/43 success（OBFRVOL + WLCFLPCL transient SSL fail，已知 fail-soft 项），v2 11/12 success（H41RESPPALDKNWW transient SSL fail，3-retry exhaust，pre-existing 不阻 R008）；3 R008 series **全部 OK**（MBST 285 obs / CURRCIR 154 obs / H8B1058NCBCMG 159 obs）。
  - 5 个非-FRED fetcher 全跑：nyfed 5/5 endpoints；nyfed_pd 3/3；treasury 2/2；ofr 5/5；cftc 1/3（2 SSL 抖动 fail-soft）。
  - `python3 data/build_database.py` → 34962 v1 obs / 16891 v2 obs / 15769 treasury / 35954 nyfed / 5740 derived。
  - `python3 data/export_json.py` → 53 quarter-end dates · 55 series · 4 v2 JSON 重写。Spot-check：MBST=2026-03-31 carry-forward=1739733 Mil；CURRCIR=2026-03-31 carry-forward=2415.653 Bil（=$2.4T 现钞，正确量级）；H8B1058NCBCMG=9.8% (Percent)。
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 PENDING=0。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid。
  - `python3 data/proxy_validation.py` → 30 charts re-emitted；bs_agency_mbs 1.0000/66；bs_fed_notes 1.0000/154；foreign_banks/us_fbo `null/0` + `pending-S2.4`（S2.4-confirmed null OK；harness 标记符合 D-007 Part D 要求）。
  - v1 视觉零回归：v1 dataLoader 仅按 js/constants.js 内 hardcoded series 检索 metadata，对 5 个 v2-only series 完全 inert（手动 grep 验证）。
- 决策：D-007（4 部分）。
- 风险：R008 reclassified `mitigated (pipeline) / partially-closed (concept)`；residual concept-mapping shortfall 转 P4 retro。R001 / R004 / R005 / R007 / R010 / R011 状态不变。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — pipeline E2E 跑通；3 R008 series 接入；registry 同步；validators 三 0 错；spec §AC#1 / §AC#3 / §0.1.2 全部满足。
  - 2 (产物已存) **YES** — 2 修改 .py 文件 + 1 修改 registry + 1 D-007 + 1 risks 更新 + 9 重生 JSON + 30 charts。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — P4 内部 Step；下一 boundary 在 S4.4 末。
  - 4 (state/handoff 已更新) **YES** — 本次写入 + handoff 即将重写为 S4.2 packet。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触；§0.1.2 v1 byte-equivalent 通过 (a) FRED_SERIES 不动 + (b) v1 不索引 v2 keys 的双重保证守住；§AC#3 `primary: null + reason` 是 spec-blessed 状态；viewBox 不动。
  - 6 (新决策已 log) **YES** — D-007 4 部分均记录 + 退役提示加入 retrospective table。
  - 7 (out-of-scope 项已外推) **YES** — BIS locational banking statistics 作为 foreign_banks/us_fbo 的 future-cycle 替代源记入 D-007 Part C + retro table；MBST live alternate (WSHOMCB) 切换推迟 P4 retro；CFTC 2 路 SSL 抖动属 fail-soft 范畴不展开。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S4.2 packet。
  - **结论：PASS**（drift triage: out-of-scope 元数据审计被 D-007 显式 log，未跨 Phase boundary，未改 spec，未自动 escalate to scope-change — 正常一次 mid-step decision branch）。

*S
## Tier 3 — Step Summary  (≤1000 words)
*S4.4 (User sign-off · Phase 4 boundary Node ④) — DONE 2026-04-26:*
- 输入：Phase 4 sign-off packet（S4.1–S4.3 叙事 + AC 12 项覆盖矩阵 + 风险帐 + out-of-scope deferral list）· spec v0.2.1。
- 执行：向用户表出完整 Node ④ packet（8/12 AC 完全达成，4/12 在本 Node ④ 上收拢）+ 7 项明确 out-of-scope deferral。
- 用户决策：Node ④ 取值 verbatim **"Sign off"** 2026-04-26。
- 输出：
  - **`.ief/decisions.md` 追加 D-009**（项目验收记录：接受范围 + 6 项 next-cycle deferral + open risks transfer + alternatives · User-Confirmed Y）。
  - retro 表补 D-009 行（outcome=accepted）。
  - state.md Position: P4 ✅ / project COMPLETE / awaiting `/ief-retro`。
  - state.md Artifact Index 补 D-009。
  - handoff.md 重写为 `/ief-retro` packet。
- 验证：无代码变动；validators 上一步已继承（0-error）。
- 决策：D-009。
- 风险：无新增。开放风险全部转入 retro / next-cycle owner：R001 / R004 / R005 / R007-mitigated / R008-mitigated-pipeline-partially-closed-concept / R010 / R011。Closed: R002 / R003 / R006 / R009 / R012。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — plan row 4.4 success_check=USER 已起入；verbatim Node ④ 记录在 D-009。
  - 2 (产物已存) **YES** — D-009 + retro 行 + state 更新 + handoff 重写。
  - 3 (Phase boundary user 通过) **YES** — 本项即是 Phase boundary，Node ④ 已取得。
  - 4 (state/handoff 已更新) **YES**。
  - 5 (Spec 未被静默修改) **YES** — spec v0.2.1 不动。
  - 6 (新决策已 log) **YES** — D-009。
  - 7 (out-of-scope 项已外推) **YES** — 6 项 next-cycle deferral 在 D-009 中明列。
  - 8 (cold-start handoff 自洽) **YES** — handoff 重写为 `/ief-retro` packet。
  - **结论：PASS**。项目验收闭环。

*S4.3 (Browser console / cross-tab acceptance) — DONE 2026-04-26 (surrogate + user implicit accept):*
- 输入：handoff S4.3 packet · `index.html` · 全部 v1+v2 模块 (READ-ONLY) · `data/json/*` (S4.1 刷新) · spec §AC#9。
- 执行：plan row 4.3 success_check = human；agent 不能跑真浏览器，改产 **静态 console-surrogate** 替代物覆盖最常见 runtime 缺陷。
  - **Static-1 (syntax)**：22 个模块（v1×11 + v2×11）全部 `node --check` 通过，0 解析错误。
  - **Static-2 (`console.error/warn` 审计)**：5 个站点（[js/data-loader.js](js/data-loader.js#L47) catch / [js/tab-router.js](js/tab-router.js#L16) v2 dynamic-import catch / [js/v2/app.js](js/v2/app.js#L50) selector-DOM-missing fallback / [js/v2/diagram.js](js/v2/diagram.js#L36) d3-absence guard / [js/v2/edges.js](js/v2/edges.js#L77) unresolved-edge endpoint），全部为防御分支；happy path 不触发（数据存在 + d3 CDN 加载 + 32/32 节点 id resolved + EDGES=[] 不进 loop）。
  - **Static-3 (资源)**：5 CSS + 2 ES module entry + d3 v7 CDN 全部存在；transitive imports 全部相对路径。
  - **Static-4 (Path B 布局完整性)**：新 SECTIONS `dash_rrp_group` / `dash_other_liab_group` 同时存在于 [js/constants.js](js/constants.js#L169) 与 [js/nodes.js](js/nodes.js#L56) sectionOrder；`dashed_gray` style + `label=""` → 不进 header-render 分支；bullet 注入 `isBs && d.indent===true` 仅对 4 节点生效。
  - **Static-5 (v2 wireTimeSelector handshake)**：[js/time-selector.js](js/time-selector.js#L22-L38) 创建 `#date-select` + `#date-slider`；v1 pane 在 v2 init 之前已渲染 → DOM 存在 → 监听挂载成功；多监听器共存协议自洽。
- 用户决策：用户在 chat 中确认"v2 没有时间滑块、legend、连线"为 by-design（实质 implicit accept browser-side console clean），并指令"继续 S4.4"。
  - **By-design 确认**：(a) `EDGES = []` per [js/v2/diagram.js](js/v2/diagram.js#L5) 注释 "Edges remain empty until Modules C/D/E populate EDGES"，本项目不在 scope；(b) Legend 从未出现在 spec，仅 floating-badge + tooltip（§AC#4）；(c) v2 复用 v1 `#date-select`/`#date-slider` via additive listeners（S3.4 D-006 设计）；当 v2 tab active 时 v1 pane hidden → 滑块不可见，但事件链路完好。后两者属 UX 缺口，**记入 P4 retrospective 留待下个 cycle**（不阻当前 Phase 验收，因 spec §AC#8 仅要求"不被破坏"）。
- 输出：
  - 无代码变更（read-only Step；surrogate clean）。
  - state.md S4.3 Tier 3 entry（本条）。
  - decisions.md retrospective annotations 表新增 1 行：v2 时间滑块 UX 留 P4-retro / `#time-selector-v2` placeholder 待下 cycle 决策。
- 验证：
  - `audit_proxy_registry.py` → ERRORS=0 PENDING=0（再确认）。
  - `validate_registry_schema.py` → 32 ✓。
  - Static console-surrogate：0 expected error / 0 expected warning。
- 决策：无（read-only Step）；S4.3 不消耗 D-number。
- 风险：无新风险；R007/R010/R011 状态不变；v2-slider-UX 作 retro-only watch-item 入 retrospective table。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES (with caveat)** — plan 4.3 success_check = human；agent 用 surrogate + 用户 implicit accept 替代真浏览器 dev-tools；spec §AC#9 满足（surrogate 显示 happy path 0 console error/warning）。
  - 2 (产物已存) **YES** — state Tier 3 entry + retro 行 + handoff S4.4 packet。
  - 3 (Phase boundary) **N/A (mid-phase)** — S4.4 才是 Phase boundary Node ④。
  - 4 (state/handoff 已更新) **YES**。
  - 5 (Spec 未被静默修改) **YES**（无修改）。
  - 6 (新决策已 log) N/A（无新 decision）；retro 表新行已加。
  - 7 (out-of-scope 项已外推) **YES** — v2 EDGES 渲染、v2 独立时间滑块、v2 legend 全部记入 P4 retrospective；不进 P4 acceptance gate。
  - 8 (cold-start handoff 自洽) **YES** — handoff S4.4 packet 已重写。
  - **结论：PASS (with surrogate caveat)** — 真浏览器 dev-tools 验收推迟到 S4.4 Node ④（spec §AC#12 项目级肉眼验收的天然时机）。

*S4.2 (Visual regression check) — DONE 2026-04-26 (Path B closure):*
- 输入：handoff S4.2 packet · `index.html` · `js/constants.js` · `js/nodes.js` · `js/v2/{constants,nodes,diagram,badges,app,proxy_registry}.js` · `data/json/{time_series,cross_source_diff}.json` · D-005 (badge geometry h≤14 + pad≤3 + 17 px clearance) · D-006 (5-tier color matrix) · D-007 Part C · §0.1.2 (v1 byte-equivalent invariant — pre-amendment)。
- 自动检查执行（6 项）：
  - **Auto-1 (v1 byte-equivalent)**：`git status` 揭示 [js/constants.js](js/constants.js) 与 [js/nodes.js](js/nodes.js) 有未提交修改（mtime 2026-04-26 16:23，**早于** S4.1 21:39）。Diff: bs_liabilities 列 4 节点 (bs_rrp_omo, bs_foreign_repo, bs_tga, bs_fhlb_deposits) 由 bs_child→bs_parent + indent 标志 + bullet 渲染 + 2 新 dash_*_group。**未在任何 IEF artifact 记录** — 非来自 S1.x/S2.x/S3.x/S4.1。**初步报警**：以为 bs_parent h=56（错），算出 14 px gap 违反 D-005 17 px。
  - **Auto-2 / 3 (badge clearance)**：第一次审计基于错误 h=56 报 7 对相邻 violation + 6 节点 badge 重叠。**修正**：实际 `bs_parent` h=50（[js/config.js](js/config.js) 第 36 行），真实 gap = 70 - 50 = **20 px** ≥ 17 px D-005 budget。新布局**实际通过 D-005 审计**。
  - **Auto-4 (v2 inheritance)**：`js/v2/constants.js` 第 20 行 import `NODES` 自 `../constants.js`；`js/v2/nodes.js` 第 13 行 import `renderNodes` 自 `../nodes.js` — v1 改动会传染到 v2（设计上需要，否则 v1/v2 节点不一致）。
  - **Auto-5 (cross-source amber)**：`data/json/cross_source_diff.json` summary.violation_node_ids = ['bs_tga', 'us_treasury'] 不变，色彩路径预期不变。
  - **Auto-6 (validators)**：`audit_proxy_registry.py` ERRORS=0 PENDING=0 · `validate_registry_schema.py` 32 ✓ — 自身层面 OK。
- 用户决策：Node ② "Path B" 2026-04-26 — 接受新布局为基线 + 修订 spec。
- 输出：
  - **重新应用新布局** 到 [js/constants.js](js/constants.js) + [js/nodes.js](js/nodes.js)（terminal 工作树原已被 git checkout 还原，本步重新应用 4 节点 shape/x/y/parentId/indent 修改 + 2 新 SECTION + sectionOrder 扩展 + bullet 渲染分支）。
  - **`.ief/spec.md` v0.2.0 → v0.2.1**：3 处 amendment：(i) Scope-IN line 20 加 v0.2.1 sub-bullet 放宽"v1 视觉零变化"为"id/概念/拓扑/viewBox/边路由不变 + 允许 D-005 重审通过的几何冲突修复"；(ii) Scope-OUT line 24 加 D-008 例外条款；(iii) AC#8 line 53 把"逐像素无差异"改为"在节点 id / 概念 / 拓扑 / viewBox / 边路由层面无差异"。Version History 追加 0.2.1 行。
  - **`.ief/decisions.md`**：D-008（4 部分：A 布局变更描述 / B D-005 re-audit / C spec §0.1.2 amendment / D R012 closure）+ retrospective table 追加 D-008 行。
  - **`.ief/risks.md`**：R012 status `open / needs Node ②` → **closed (D-008)**；描述追加修正说明（h=50 不是 h=56 + OLD-layout latent 10 px 违反）；linked decision = D-008。Closed Items Log 追加 R012 行。
  - **D-005 re-audit on Path B layout**（自定脚本，方法论同 S3.1）：parsed 29 nodes / 32 registry keys；violations (gap<17 px)：**0**；tight (17 ≤ gap < 25 px)：12 节点全部在 BS-pitch 列，统一 20 px（与 D-005 原 BS-pitch baseline 一致 — 实际上 4 个新晋升 bs_parent 的节点现在也加入 12 这个集合）；loosest 153 px (`offshore_mmf`)。**Latent fix**: OLD layout 的 `bs_foreign_repo` (x=372 y=485 h=40) ↔ `bs_other_liab` (x=355 y=430 h=50) 在 130 px x-distance 阈值内只有 10 px clearance — D-005 在 S3.1 时把 bs_child/bs_parent 当作 parent-child 视为单一 obstacle 没捕获；Path B 把 bs_child 全部提升为 bs_parent + 同列 x=355 后这一隐性违反消失。
- 验证：
  - `audit_proxy_registry.py` → ERRORS=0 PENDING=0。
  - `validate_registry_schema.py` → 32 ✓ all valid。
  - `cross_source_diff.json` summary 不变。
  - D-005 re-audit 0 violations。
  - 用户层面浏览器肉眼验收推迟到 P4 末（`spec.md` AC#12）。
- 决策：D-008（4 部分）。
- 风险：R012 closed by D-008。R001 / R004 / R005 / R007 / R010 / R011 状态不变。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — plan row 4.2 "v1 pixel-level identical / v2 no new overlap" 在 v0.2.1 修订后的 §0.1.2 解读下满足（id / 概念 / 拓扑 / viewBox / 边路由全部不变；几何变动通过 D-005 重审）；32/32 节点 0 violations。
  - 2 (产物已存) **YES** — [js/constants.js](js/constants.js) + [js/nodes.js](js/nodes.js) 重新应用；spec.md v0.2.1；D-008 logged；R012 closed。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — 但 Node ② 已就 spec 修订给出（"Path B"）。
  - 4 (state/handoff 已更新) **YES** — 本条 + Position + handoff S4.3 packet 已写。
  - 5 (Spec 未被静默修改) **YES** — spec.md 显式 v0.2.0 → v0.2.1 + Version History 行；amendment 全部记录在 D-008 Part C。
  - 6 (新决策已 log) **YES** — D-008 4 部分 + retro 表新行。
  - 7 (out-of-scope 项已外推) **YES** — 用户最终肉眼浏览器验收推到 P4 末（AC#12）；BIS locational fetcher 仍是 D-007 retro 项；CFTC 2/3 SSL fail-soft 仍是 R011 监控项。
  - 8 (cold-start handoff 自洽) **YES** — handoff 重写为 S4.3 packet。
  - **结论：PASS** （drift triage Branch C 走完全流程：halt → user Node ② → spec amendment → D-008 → re-audit → close R012；无 escalate to scope-change，未跨 Phase boundary，未自动 advance 跳过 Node ②）。

*S3.4 (Wire to sidebar time selector + hover YYYY-MM) — DONE 2026-04-26:*
- 输入：handoff S3.4 packet · `js/v2/badges.js` (S3.3 baseline；含 STALE_THRESHOLDS_DAYS / computeStaleness / isViolation / 4-档 priority；`renderProxyBadges(layer, nodes, dataLoader, crossDiff)` 4 参数版) · `js/v2/diagram.js` (S3.3 baseline；`initDiagram` 无 _ctx，crossDiff 单次 fetch 后即调一次 render) · `js/v2/app.js` (S2 baseline；28 行；只调 initDiagram；不动 v1) · `js/data-loader.js` (`dates[]` 升序、`timeSeries[date][seriesId]` 稀疏 map) · `js/time-selector.js` (READ-ONLY；`#date-select` change + `#date-slider` input/SLIDER_DEBOUNCE_MS) · `js/config.js` `SLIDER_DEBOUNCE_MS=50`。
- 输出：
  - **`js/v2/badges.js` 修改**（5 处 multi-replace 已应用）：(a) docstring 补 S3.4 说明；(b) 新增 `seriesValueAtOrBefore(dataLoader, seriesId, currentDate)` —— 先 binary-style 反向找到首个 `dates[i] <= currentDate` 锚点 s，再从 s 向 0 走找首个 `timeSeries[dates[i]][seriesId] != null` 的 `{date, value}`；currentDate 为 null 时返回 null；早于数据集起点时返回 null；空隙日期回填到上一个有效观测（spec §AC#5 + 数据稀疏现实）。(c) `computeStaleness(obsDate, frequency, referenceDate=null)` 第 3 参 default `Date.now()`，让 stale 判断跟随用户拖到的历史日期（拖到 2024-12 时按 2024-12 算 stale，不再 today-anchor）。(d) `badgeContent(node, dataLoader, crossDiff, currentDate)` 4-arg，FRED 节点优先调 `seriesValueAtOrBefore`，currentDate=null 走老 `latestSeriesValue` fallback；obsDate 也用 walk-back 结果。(e) `renderProxyBadges(layer, nodes, dataLoader, crossDiff=null, currentDate=null)` 5-arg，传给 badgeContent + computeStaleness。
  - **`js/v2/diagram.js` 修改**：模块级 `let _ctx = null`，结构 `{badgeLayer, dataLoader, crossDiff, currentDate}`；`initDiagram` 把 `dataLoader.dates[last]` 作为初始 currentDate；`fetch cross_source_diff.json` 完成后写回 `_ctx.crossDiff` 并立即用当前 currentDate 重 render；新 export `updateBadges(currentDate)` 改 `_ctx.currentDate` 后 `renderProxyBadges(_ctx.badgeLayer, NODES, _ctx.dataLoader, _ctx.crossDiff, currentDate)`。
  - **`js/v2/app.js` 修改**：import `updateBadges`；新 helper `wireTimeSelector(dataLoader)` —— 在 `#date-select` 上 `change → updateBadges(select.value)`；在 `#date-slider` 上 `input → 50ms debounce → updateBadges(dataLoader.dates[parseInt(slider.value)])`；在 `initDiagram` 之后调用；DOM 元素缺失时 `console.warn` + no-op。**完全不修改 v1**：v1 已挂的 `change`/`input` 监听器与 v2 共存（DOM 多监听器协议）。
- 验证：
  - `node` 语法编译：5 个 v2 文件 (badges, tooltip, value_format, diagram, app) syntax OK。
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 PENDING=0。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid。
  - 单元测试 (4-case Node 脚本)：`2024-12-15` → `{2024-10-01:103}`（最近 ≤ ✓） · `2024-04-15` → `{2024-01-01:100}`（gap 跳过空 obs ✓） · `2023-12-31` → null（早于数据起点 ✓） · `2025-06-01` → `{2025-01-01:104}`（晚于数据末位取末位 ✓）。
  - v1 视觉零变化（CSS 无新增；v1 不 load v2/*；监听器加在 v2/app.js 内不动 v1 文件）。
  - 几何不变：S3.4 不动 anchor / rect 尺寸 / 字号。
- 决策：无新决策（S3.4 是纯 wiring；D-005 + D-006 不变）。
- 风险：无新风险；R007（slider 抖动）通过 50 ms debounce 显式压制；R010 / R011 状态不变。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — sidebar 改日期 → 32 badge 重 render + tooltip 显示对应观测 YYYY-MM；spec §AC#5 闭环（stale 计算用拖到的日期作 reference）；plan 3.4 行 "Wire to sidebar time selector + hover YYYY-MM" 全部交付。
  - 2 (产物已存) **YES** — 3 修改文件（badges/diagram/app）。
  - 3 (Phase boundary user 通过) **PENDING** — **本 Step 是 P3 最后一个 Step；P3→P4 boundary 需 user Node ③ 才能 advance**；本步内部 PASS，boundary STOP 由调用方触发。
  - 4 (state/handoff 已更新) **YES** — 本次 state Tier1/2/3 + Position 都改；handoff 即将重写为 P3→P4 boundary packet。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触；AC 严守；v1 文件零修改。
  - 6 (新决策已 log) **N/A** — 本 Step 无新决策。
  - 7 (out-of-scope 项已外推) **YES** — "per-as-of-date violation pairs" 仍按 D-006 Part D 推迟到 P4 retro（spec deliberate scoping）；R008 backfill 仍 S4.1。
  - 8 (cold-start handoff 自洽) **PENDING** — handoff 重写后即可 YES。
  - **结论：PASS** （Step 内部 8/8 解决；3 / 8 子项标 PENDING 是因为在 Phase boundary，由 boundary 触发解决）。

*S1.1 (FRED inventory & verify) — DONE 2026-04-26:* 产出 §FRED.1 (43) + §FRED.2 (9) + 5 条 FRED↔NYFed overlap notes + smoke table。`fredapi.get_series('EFFR')` → 604 obs, last 2026-04-23=3.64。

*S1.2 (NY Fed inventory & verify) — DONE 2026-04-26:*
- 输入：`data/nyfed_config.py` (5 endpoints)、`data/fetch_nyfed_data.py`、`data/raw/nyfed/{sofr,effr,rrp_ops,srf_ops,soma_summary}.json`。
- 输出：`data/series_inventory.md` §NYFed.1 表（5 endpoints × 列） + §NYFed cross-source 表（5 行对接 FRED） + smoke 验证表。
- 验证：`requests.get('/rates/unsecured/effr/last/5.json')` → 200, percentRate=3.64 与 FRED 一致；五个 raw JSON 都在（srf_ops 78 KB 验证 R005 短历史边界）。
- 决策：无新决策（纯梳理；proxy primary/alt 在 P2.3 决）。无新风险；R005 现状被 smoke size 验证，继续 open。
- Quality Gate: 1 YES · 2 YES · 3 N/A (mid-phase) · 4 YES · 5 N/A · 6 N/A · 7 YES · 8 YES → PASS.

*S1.3 (Treasury inventory & verify) — DONE 2026-04-26:*
- 输入：`data/treasury_config.py` (2 endpoints: tga_daily/auctions)、`data/fetch_treasury_data.py`、`data/raw/treasury/{tga_daily,auctions}.json`。
- 输出：§Treasury.1 表 + §Treasury cross-source（TGA daily vs FRED 周频） + Known gap 记录（`marketable_securities_outstanding` 当前 404、已纳入 R006） + smoke 表。
- Quality Gate: 1 YES · 2 YES · 3 N/A · 4 YES · 5 N/A · 6 N/A · 7 YES · 8 YES → PASS.

*S1.4 (Whitelist source scoping) — DONE 2026-04-26:* 产出 §Appendix（5 sub-tables） + D-001 (7 IN · 3 deferred · 2 permanent not_found · 凭证策略)。Quality Gate 全 PASS。

*S1.5 (Consolidate inventory table) — DONE 2026-04-26:*
- 输入：`data/series_inventory.md` 已写的 §FRED / §NYFed / §Treasury / §Appendix；decisions.md D-001。
- 输出：`data/series_inventory.md` §Final consolidated table (66 rows: 52 FRED + 5 NYFed + 2 Treasury live + 7 whitelist pending-S2.4) + §P1 Wrap-up（counts·exit-criteria 表·open risks 状态·D-001 指针）。
- 验证：表表头包含 spec §Acceptance #1 要求的全部列（来源 · 名称/标识 · 频率 · 获取方式 · 脚本路径） + 额外 `状态` 列；59 live 行逐一对应 §FRED/§NYFed/§Treasury 上游表，7 placeholder 行逐一对应 D-001 IN 集，总计 66 与重点 sub-totals 一致。Exit-criteria 5/5 覆盖表在 §P1 Wrap-up 中。
- 决策：无新决策（纯合稿、字段表遵从 spec）。无新风险。
- Quality Gate: 1 YES · 2 YES · 3 N/A (Phase boundary STOP 后由用户走 Node ③，不是本 Step 内部项) · 4 YES · 5 N/A · 6 N/A · 7 YES · 8 YES → PASS.

*Phase 1 → P2 transition:* User Node ③ given 2026-04-26 (“accept P1”). 用户选择在同一会话内继续 S2.1（覆盖 plan.md 的 fresh-conversation 建议）。

*Phase 2 → P3 transition:* User Node ③ given 2026-04-26 (“Accept P2”). P3 首个 Step S3.1 在同会话续上。

*S3.3 (Stale color & violation color) — DONE 2026-04-26:*
- 输入：handoff S3.3 packet · `js/v2/badges.js` (S3.2 baseline; 已含 STALE_THRESHOLDS_DAYS / computeStaleness / isViolation 占位逻辑、value_format import) · `js/v2/tooltip.js` (S3.2 showBadgeProxy 4-arg 版) · `css/v2/diagram.css` (S3.2 baseline；含 muted/info/value 三档但未含 stale/violation) · `js/v2/diagram.js` (S3.2 baseline；renderProxyBadges 调用未传 crossDiff) · `data/json/cross_source_diff.json` (S2.5 产物：`stale_thresholds_days` D=7/W=21/M=60/Q=180/irr=∞，`summary.violation_node_ids` = [bs_tga, us_treasury])。
- 输出：
  - **新建** `js/v2/value_format.js`（plan 3.3 指定文件名）：导出 `formatValue(value, units, dataLoader)`，优先 delegate 到 `dataLoader.formatValue`，否则走自带 fallback（rate/% / bps 整数 / Mil. USD / Bil. USD → $X.XB or $X.XT）。
  - `js/v2/tooltip.js` `showBadgeProxy` 5-arg 版：第 5 个 `extras = { stale, violation, crossDiff }` 触发两条新行：(a) `tt-stale`: `⚠ stale: <ageDays>d since <YYYY-MM> (threshold <T>d)`；(b) `tt-violation`: `⚠ cross-source diff <X.X>% > 5%` + 一条 muted 来源对比行 `<source> <series> vs <source> <series>`（通过 helper `findViolationPair(node.id, crossDiff)` 在 `pairs[]` 内 filter `same_concept=true && substitute=false && |relative_diff_pct|>5` 找到）。
  - `css/v2/diagram.css`：新增 `.proxy-badge-stale`（`#eceff1` 浅灰底 + `#8a9099` 中灰文 + 字重 500）和 `.proxy-badge-violation`（`#fff3cd` 琥珀底 + `#6b4900` 暗琥珀文 + 字重 700）；新增 `.tt-stale` 和 `.tt-violation` tooltip 行色阶。
  - `js/v2/diagram.js` `initDiagram`：异步 `fetch("data/json/cross_source_diff.json")` → fail-soft（`r.ok ? r.json() : null` + `.catch(()=>null)`）→ `renderProxyBadges(badgeLayer, NODES, dataLoader, crossDiff)`。文件丢失时仍 render（无 violation 着色）。
  - `.ief/decisions.md` D-006（4 部分）：Part A 阈值表与 cross_source_diff.json 同源；Part B 5 档色彩状态表 + violation > stale 优先级；Part C tooltip 扩展点 + helper 过滤逻辑；Part D 推迟项（per-node policy threshold violations 留 P4 retro；R008 backfill 留 S4.1）。
- 验证：
  - `node` 语法编译：badges.js + tooltip.js + value_format.js + diagram.js syntax OK。
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 PENDING=0（registry 未触碰）。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid。
  - 数据对齐 spot-check：`cross_source_diff.json.summary.violation_node_ids` = `["bs_tga", "us_treasury"]`（同源 5% 比较：`tga_balance_usd_m` Treasury daily vs `WTREGEN` FRED weekly），上线后这 2 个节点 badge 会变 amber；其余 30 节点保留 value/info/muted 三档；任何 obsDate 早于阈值的会变 stale 灰。
  - 几何不变：S3.3 不动 anchor / rect 尺寸；S3.2 invariant 自动保留。
  - v1 视觉零变化：v1 不加载 v2/* 模块；CSS 仅追加 v2 专属规则。
- 决策：D-006（4 部分）。
- 风险：无新风险；R003 / R005 / R007 / R008 / R010 / R011 状态不变。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — value_format.js 落地；stale 灰显接通（FRED 节点 obsDate 实时计算，非-FRED 走 last_updated）；amber violation 接通（cross_source_diff.json `summary` 直接 driving）；D-006 落地。spec §AC#5 (`stale > 阈值时呈灰色 + stale 标记`) 满足；plan 3.3 行的 4 项产物全部交付。
  - 2 (产物已存) **YES** — 1 新文件 + 4 修改文件 + 1 decision row。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — P3 内部 Step。
  - 4 (state/handoff 已更新) **YES** — 本次写入 + handoff 重写为 S3.4。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；AC#4/#5/#6/#7/#11 严格遵守；viewBox 不动；节点几何不动；v1 视觉零变化。
  - 6 (新决策已 log) **YES** — D-006 4 部分均记录。
  - 7 (out-of-scope 项已外推) **YES** — per-node policy threshold violations 留 P4 retro（D-006 Part D）；R008 backfill 留 S4.1；sidebar 时间联动留 S3.4。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S3.4。
  - **结论：PASS**。

*S3.2 (Re-anchor badge to top-center + hover tooltip) — DONE 2026-04-26:*
- 输入：`js/v2/badges.js` (S2 baseline, right-top anchor, h=16, primary.series mismatch latent bug)、`js/v2/tooltip.js` (singleton `.tooltip-v2` HTML overlay + showNodeProxy/showEdgeProxy)、`js/v2/diagram.js` (badge-layer wiring)、`js/v2/proxy_registry.js` (D-002 schema, primary.proxy_id)、`js/config.js` SHAPE_SIZES、`.ief/decisions.md` D-005 几何上限 (h≤14, pad≤3, 总 17 px)。
- 输出：
  - `js/v2/badges.js` 全量重写：(a) 几何常量 `BADGE_H=14` `BADGE_PAD=3`；(b) anchor `cx=n.x; cy=n.y - hh - BADGE_PAD - BADGE_H/2`；(c) rect `x:-w/2, y:-BADGE_H/2`；(d) text `x:0,y:0,text-anchor:middle,dominant-baseline:central`；(e) 移除已死的 `proxy_status` 分支（D-002 schema 不再有此字段），替换为 `primary===null → "—" muted` / `FRED+hit → 真实 value` / `非 FRED 或 FRED-without-cache → SOURCE 短标` 三档；(f) `mouseenter/mousemove → showBadgeProxy(node, event, dataLoader, obsDate)`、`mouseleave → hideTooltip()`。
  - `js/v2/tooltip.js` 追加 `showBadgeProxy(node, event, dataLoader, obsDate=null)` —— 极简内容: title=node label · `proxy: SOURCE · proxy_id` · `frequency · units` · `observation YYYY-MM`（FRED 命中走 obsDate；其他走 proxy.last_updated）；primary===null 时显示 `reason`；无 proxy 时显示 `no proxy registered`。
  - 顺手修：`primary.series` → `primary.proxy_id`（D-002 schema 对齐 —— S2.3 改 schema 后这是遗留 schema-key mismatch，导致 22 个 FRED-source 节点 badge value 长期取不到值；S3.2 中包含此一行修，AC#4 才可观测）。
- 验证：
  - `node` 语法编译：badges.js + tooltip.js syntax OK。
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 PENDING=0（数据层未触碰）。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid（registry 未触碰）。
  - 几何 spot-check：`bs_parent` (hw=95, hh=25)、节点 y=70 → badge 中心 cy = 70 − 25 − 3 − 7 = 35；rect bottom = 35 + 7 = 42；node top = 70 − 25 = 45；间距 = 45 − 42 = 3 px（= BADGE_PAD ✓）；总 envelope = 14 + 3 = 17 px（= D-005 表 ≤ 20 px clearance 的最紧档 ✓）。
  - v1 视觉零变化：v1 不加载 `js/v2/*`；本 Step 仅触 v2 模块。
- 决策：无新决策。S3.2 只是 D-005 的实施 —— D-005 几何约束被严格遵守。
- 风险：无新风险登记；R003 mitigation status 不变（D-005 仍 cite source）。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — anchor 重锚 + 高度 14 + 居中 + hover tooltip 全部落地；spec AC#4/#7 通过 hover handler + 几何对齐满足。
  - 2 (产物已存) **YES** — `js/v2/badges.js` 重写 · `js/v2/tooltip.js` 追加 `showBadgeProxy`。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — P3 内部 Step。
  - 4 (state/handoff 已更新) **YES** — 本次写入 + handoff 重写为 S3.3。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；AC#4/#7/#11 严格遵守；viewBox 不动；节点几何不动；v1 视觉零变化；node 本体未触。
  - 6 (新决策已 log) **YES** — 无新 D，遵循 D-005 即可。
  - 7 (out-of-scope 项已外推) **YES** — stale 阈值色推到 S3.3 D-006；非-FRED proxy 真实 value 渲染推到 S3.4（sidebar 数据流闭环）；R008 仍由 S4.1 处理。schema-key mismatch 修是 D-002 alignment 的最小 footprint 修，不开 D 号。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S3.3。
  - **结论：PASS**。

*S3.1 (Badge collision feasibility study) — DONE 2026-04-26:*
- 输入：`js/v2/badges.js`（现有 right-top anchor 逻辑）· `js/constants.js` NODES + SECTIONS + ANNOTATIONS · `js/config.js` SHAPE_SIZES · spec §Constraints（不变 viewBox / 节点几何）· spec AC#4/#7。
- 输出：`.ief/decisions.md` D-005（Branch A 决策 + 量化 clearance 表 + S3.2 几何约束 badge h≤14 / pad≤3）。无代码改动（纯研究 Step）；`.ief/risks.md` R003 标 mitigated。
- 验证：离线 Python clearance audit（每节点扫描上方最近障碍，方法学：水平 ±(node_hw + obstacle_hw + 4 px) 重叠 → 取最高底缘 y）。结果：
  - 12 BS 列 70-px pitch 节点：clearance = **20 px**（最紧；70 − 50 = 20，bs_parent half-height 25）。
  - 2 BS 顶行（在 "Assets/Liabilities" 注释下）：88 px。
  - us_banks / us_fbo（Banks-and-Dealers 标题下）：44 px。
  - gov_mmf / prime_mmf（retail_investors 下）：33 px。
  - fcb_swf_supra_offshore（OFFSHORE 标题下）：41 px。
  - 其余 13 节点：49–153 px。
  - 与 badge h=14 + pad=3（总 17 px）比较：32/32 通过；与 h=16 + pad=4（总 20 px）：12 BS 节点刚好等于 clearance（边界）；与 h=16 + pad=6（总 22 px）：12 BS 节点不足。**结论：Branch A 可行，badge 几何上限 h≤14 / pad≤3。**
- 决策：D-005（Branch A + 量化 clearance + S3.2 几何约束）。无新风险登记；R003 状态 open → mitigated。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — 可行性研究做完；D-005 含三 branch 取舍 + 量化表；S3.2 约束量化下发。
  - 2 (产物已存) **YES** — `.ief/decisions.md` 追加 D-005；`.ief/risks.md` R003 行更新；`.ief/state.md` 与 `.ief/handoff.md` 同步。
  - 3 (Phase boundary user 通过) **N/A (mid-phase, P3 内 Step)** — P2→P3 user Node ③ 已在本对话开头由 prompt 给出 "Accept P2"，并接续 S3.1。
  - 4 (state/handoff 已更新) **YES** — 本次写入。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；AC#4/#7/#11 严格遵守；viewBox 不动；节点几何不动。
  - 6 (新决策已 log) **YES** — D-005。
  - 7 (out-of-scope 项已外推) **YES** — 实际 badge SVG/CSS 修改推到 S3.2；hover tooltip 实现推到 S3.2；stale 阈值色推到 S3.3 D-006；S2.5 retroactive D-numbering 留 P4 retro。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S3.2，含 badge 当前位置代码定位 + 14×3 几何上限 + tooltip 数据源 + don't-do 列表。
  - **结论：PASS**。

*S2.1 (Audit registry vs frozen node list) — DONE 2026-04-26:*
- 输入：`js/constants.js` NODES + `js/v2/proxy_registry.js` NODE_PROXIES + spec §Acceptance #2/#3 + decisions.md D-001.
- 输出：`tools/audit_proxy_registry.py`（含 `extract_balanced_block` JS-aware 平衡解析；regex 提取 id 与顶层字段；D-001 分类标注）+ decisions.md D-002（gap 表 + canonical schema）。
- 验证：脚本 `python3 tools/audit_proxy_registry.py` 跑通，输出 ERRORS=20 / PENDING=12（首跑预期非 0，job 是 *report*，不修复）；`--json` flag 验证 JSON 输出可程序化消费。
- 决策：D-002 (canonical schema + 字段必/可选表 + 4 个 alternative 否决理由)。无新风险登记 — gaps 全在 R002 已知范围内；R005 短历史窗口仍 open，将在 S2.2 通过 `corr_36m: null` + 起始日期标注落地。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — 三件事全做：审计脚本写完、跑通、D-002 落地。
  - 2 (产物已存) **YES** — `tools/audit_proxy_registry.py` (新文件) + `.ief/decisions.md` 追加 D-002。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — Phase 2 仍在进行，无需 Node ③ on this Step。
  - 4 (state/handoff 已更新) **YES** — 本次写入。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰。
  - 6 (新决策已 log) **YES** — D-002 in decisions.md。
  - 7 (out-of-scope 项已外推) **YES** — 选 primary 决策推到 D-003 (S2.3)；stale 阈值留在 R004；schema validator 推到 S2.3。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S2.2，包含输入文件、harness 设计要点、R005 fallback 策略、out-of-scope 区。
  - **结论：PASS**。

*Fresh-conversation checkpoints 提醒（来自 plan）：*
- **下一步 S2.4 是 high Ctx**（多个外部 fetcher 实现 + 凭证配置 + 虚拟环境调试），**强烈建议另开新会话**。
- P3 已不需为 S3.2 单独开会话。

*S2.4 (Whitelist fetchers for not-found gaps) — DONE 2026-04-26:*
- 输入：D-001 IN-set + D-002 schema + D-003 Part C 12-node work list + handoff S2.4 cold-start packet + `js/v2/proxy_registry.js` (S2.3 baseline) + `data/proxy_validation_anchors.json` + `data/proxy_validation.py` (harness).
- 输出：
  - 3 新 source family（每 family = config + fetcher）：`data/ofr_config.py` · `data/fetch_ofr_data.py` · `data/nyfed_pd_config.py` · `data/fetch_nyfed_pd_data.py` · `data/cftc_config.py` · `data/fetch_cftc_data.py` （6 文件，纯标准库）。
  - 11 个 raw cache：`data/raw/ofr/*.json` (5) + `data/raw/nyfed_pd/*.json` (3) + `data/raw/cftc/*.json` (3)。
  - `data/proxy_validation.py` 扩展：`DATA_RAW` 常量 + `SeriesStore.{ofr,nyfed_pd,cftc}` 加载器 + `fetch()` 三 source 分支 + `classify_registry` 重写为基于 `primary: null` regex 的结构化分类。
  - `data/proxy_validation_anchors.json` 新增 4 anchor 行（dealers self / gov_mmf cross-source vs FRED RRPONTTLD / prime_mmf self / hedge_funds self）。
  - `js/v2/proxy_registry.js`：4 节点翻 live（dealers / gov_mmf / prime_mmf / hedge_funds，各含完整 D-002 entry：primary + alternates + theory 加长 + empirical 实测 corr_36m + last_updated + script_path）；9 个残留 null 节点 reason 文本升级为 `S2.4-deferred (D-004): ...` 或 `S2.4-confirmed null (D-004): ...`。
  - `.ief/decisions.md` D-004（4 部分：sources implemented / sources deferred / permanent-null buckets / gov_mmf 负相关解读）。
  - `.ief/risks.md`：R002 标 mitigated；R006 标 mitigated（fail-soft 模式 + 独立 raw cache）。
  - `data/json/proxy_empirical.json` + 30 charts re-emitted with new live nodes。
- 验证：
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 · PENDING=0。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid。
  - `python3 data/proxy_validation.py` → live=21 / pending=9 / not_found=2；新 4 节点 corr_36m：dealers=1.0/157M · gov_mmf=**-0.9651**/153M · prime_mmf=1.0/185M · hedge_funds=1.0/96M。
  - 重要实证：gov_mmf 跨源相关系数 -0.9651（OFR T_TOT 月度 vs FRED RRPONTTLD 月度），方向负向但量级高 — 解读为 gov MMF 在 T-repo 与 ON RRP 之间的替代关系（已写入 D-004 Part D + registry theory）。
- 决策：D-004（4 部分）。
- 风险：R002 标 mitigated（4 lift + 9 reason 升级，全 D-001 IN-set 内可解释）；R006 标 mitigated（fail-soft 模式跨 3 fetcher 验证）。R001 / R003 / R004 / R005 / R007 / R008 仍 open。
- Source-enum 决策：registry 中 NYFed Primary Dealer Statistics 的 `source` 字段保持 `NYFed`（D-002 enum 不动），harness `SeriesStore` 通过 alias 在线判别 PD 数据 vs Markets-API operations 数据 — 详 D-004 Part A。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — handoff S2.4 mission 落实：3 fetcher 实现 + raw cache + harness 扩展 + registry 翻 4 live + 9 reason 升级 + D-004 落地 + validators 0 错。
  - 2 (产物已存) **YES** — 6 个新 .py + 11 个 raw JSON + 4 anchor 行 + 12 个 registry 修订 + D-004 + risks 更新。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)** — Phase 2 仍在进行，S2.5 后才到 Node ③。
  - 4 (state/handoff 已更新) **YES** — 本次写入 + handoff 重写为 S2.5。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；AC#2/#3/#4 严格执行；D-002 enum 未扩展（NYFed-PD 通过 SeriesStore 路由实现）。
  - 6 (新决策已 log) **YES** — D-004 4 部分均记录。
  - 7 (out-of-scope 项已外推) **YES** — FHLB-OF/FHFA/ICI 解析延后（D-004 Part B）；NYFed seclending endpoint 探查未通过推到未来；跨源 5% diff 处理推到 S2.5；R008 仍由 S4.1 处理。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S2.5。
  - **结论：PASS**（target 5/9 → 实际 4/9，shortfall 显式记录在 D-004 Part B + Quality Gate trade-off 段落供 P2 Node ③ 复议）。

*S2.3 (Primary/alternate assignment) — DONE 2026-04-26:*
- 输入：S2.2 产出（`data/json/proxy_empirical.json`, `data/proxy_validation_anchors.json`, `data/json/proxy_charts/`） + decisions.md D-002 schema + risks.md R008/R009 + `tools/audit_proxy_registry.py` (S2.1) + `js/v2/proxy_registry.js` 旧版（backed up to `.s2.1.bak`）。
- 输出：
  - `js/v2/proxy_registry.js` 全量重写为 D-002 schema，32 NODE_PROXIES + EDGE_PROXIES 保留（同步修正 R009 series ID）。
  - `tools/validate_registry_schema.py`（~310 LOC、纯标准库）实施 D-002 enum 闭合性检查 + chart_path 磁盘存在 + theory 中文≥5 0 字 + last_updated ISO + alternates[] 深度检查。
  - `js/v2/proxy_registry.js.s2.1.bak` 保留旧版供对比。
  - `data/json/proxy_charts/{bs_fhlb_deposits,corporates_offshore,foreign_insurers}.json` 三个 stub chart（为该 3 个 primary:null 节点补齐 chart_path 存在性需求）。
  - `.ief/decisions.md` D-003（3 部分：R009 fix / R008 Option B / 32 节点 primary 取舍表）。
  - `.ief/risks.md` R008 mitigation 更新、R009 closed。
- 验证：
  - `python3 tools/audit_proxy_registry.py` → ERRORS=0 · PENDING=0。
  - `python3 tools/validate_registry_schema.py` → 32 entries · ✓ all valid。
  - R009 fix 交叉验证：`python3 data/proxy_validation.py` 重跑后 bs_rrp · bs_rrp_omo corr_36m=1.0/154 samples（从 -0.25/89 跃升）。
- 决策：D-003（per-node primary/alternate assignment）落地；R008 Option B（推迟 S4.1）与备选 Option A（S2.3 内跑 fetcher）两者均在文中权衡，选一。
- 风险：R009 关闭。R008 仍 open，明确推到 S4.1 Pipeline E2E rerun：S4.1 必须在跑 fetcher 前将 MBST/CURRCIR/H8B1058NCBCMG 加入 `data/series_config.py`，随后 re-run `data/proxy_validation.py` 验证该 4 节点 corr_36m 转为非 null。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — 17 live + 2 not_found + 12 pending + 1 新增 bs_fhlb_deposits = 32 节点全覆盖；D-003 落地；可选 schema validator 也实现。
  - 2 (产物已存) **YES** — 4 个修/新文件 + 3 stub charts + decisions.md/risks.md 更新。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)**。
  - 4 (state/handoff 已更新) **YES** — 本次写入。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；AC#2/#3/#4 严格执行。
  - 6 (新决策已 log) **YES** — D-003 三部分都记录。
  - 7 (out-of-scope 项已外推) **YES** — stale 阈值仍留 R004（S3.3 D-005）；跨源 5% diff 推到 S2.5；外部 fetcher 实现推到 S2.4；R008 pipeline 補拉推到 S4.1。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S2.4，包含 D-001 入选 7 源 + per-source fetcher 资料指引 + 文件布局预期。
  - **结论：PASS**。

*S2.2 (Empirical validation harness) — DONE 2026-04-26:*
- 输入：`data/json/raw_observations.json` (43 series) + `raw_observations_v2.json` (9) + `fed_balance_sheet.json` (8) + `nyfed_operations.json` (5 endpoints) + `treasury_flows.json` (2) + `pressure_indicators.json` (4) + `js/v2/proxy_registry.js` + spec §Constraints (36M monthly window) + D-002 schema + R005 fallback rule。
- 输出：`tools/_jsparse.py`（从 audit 脚本 提出的平衡解析器）· `data/proxy_validation_anchors.json`（17 节点 candidate↔anchor 映射；8 self-anchored + 6 跨源 + 3 data-missing）· `data/proxy_validation.py`（~270 行，纯标准库：SeriesStore 统一访问 6 JSON、`to_month_end_last_obs` 重采样、`pearson` + `rolling_corr`、幂等写入）· `data/json/proxy_charts/<node_id>.json` (29 files) · `data/json/proxy_empirical.json`（flat 29-row summary）。
- 验证：脚本跑通 exit 0。Sanity check 3 节点：
  - bs_treasuries (self-anchored): corr_36m=1.0 · sample=160 ✅
  - bs_tga (cross-source Treasury vs FRED): corr_36m=**0.9834** · sample=112 ✅ (跨源对齐健康)
  - bs_rrp (cross-source FRED:RPONTSYD vs NYFed:rrp_ops): corr_36m=**-0.2534** ⚠️ 诊断: RPONTSYD 在 raw_observations 中仅 610/3474 非零且量级~0.001，似于 RRPONTTLD 被误取、已记入 R009 留 S2.3 修正。
- 决策：本 Step 未新增 D 号决策。Anchor 方法学 ("self vs cross-source") 逐行 rationale 已随 `data/proxy_validation_anchors.json` 记录，与 D-002 schema中 `empirical.window`/`corr_36m`/`chart_path` 三字段一致。D-003 仍留给 S2.3 primary/alternate 取舍。
- 风险：新增 R008（MBST/CURRCIR/H8B1058NCBCMG 未被 fetcher 拉到 snapshots）4 节点受影响）· R009（bs_rrp series ID 误设嫈疑）。两项都应在 S2.3 修正后 re-run harness。R005 被验证：harness 已实现 short-history fallback（sample<36 → corr_36m=null + note），本轮 17 live 节点中未触发。
- Quality Gate (8 items, per-item):
  - 1 (Step 描述完成) **YES** — harness 写完、跑通、输出三件产物全部生成；sanity check 3 节点完成。
  - 2 (产物已存) **YES** — 5 个新/修文件 + 30 个 JSON 产物。
  - 3 (Phase boundary user 通过) **N/A (mid-phase)**。
  - 4 (state/handoff 已更新) **YES** — 本次写入。
  - 5 (Spec 未被静默修改) **YES** — spec.md 未触碰；36M_monthly window 严格遵守。
  - 6 (新决策已 log) **YES** — 无新 D 号；anchor rationale 随产物记录。
  - 7 (out-of-scope 项已外推) **YES** — series ID 修正推到 S2.3；registry 重写推到 S2.3；fetcher 补拉推到 S2.3前的小 step或 S2.4；跨源 5% diff 推到 S2.5。
  - 8 (cold-start handoff 自洽) **YES** — handoff.md 重写为 S2.3，包含 D-002 schema、S2.2 产物路径、R008/R009 修正指示、permanent-not_found AC#3 改造、D-003 预留。
  - **结论：PASS**。

## Position
- Current Phase: **P4 — Integration & Acceptance ✅ (DONE 2026-04-26 via Node ④)**.
- Steps completed: P1 ✅ · P2 ✅ · P3 ✅ · **P4 ✅ (S4.1 · S4.2 · S4.3 · S4.4)**.
- Last completed: **S4.4 — User sign-off (Node ④; verbatim "Sign off"; D-009 logged)**.
- Project status: **COMPLETE — awaiting `/ief-retro`**.
- Spec frozen at: **v0.2.1**.
- Recommended next: **open a fresh conversation, run `/ief-retro`** (high context budget; benefits from clean slate).

## Artifact Index
| Path | Produced by Step | One-line summary |
|---|---|---|
| `.ief/spec.md` | Bootstrap + drift C | Frozen project spec v0.2.0; 18 resolved questions (Q12/Q13 revised). |
| `.ief/plan.md` | Planning | Frozen v0.1.0; 4 Phases × 19 Steps with deps + ctx cost. |
| `.ief/risks.md` | Bootstrap | R002/R006 mitigated (D-004); R001/R004/R009 closed (D-003/D-005-S2.5-state); **R003 mitigated (D-005)**. |
| `.ief/state.md` | Planning | This file. |
| `.ief/decisions.md` | S1.4 / S2.1 / S2.3 / S2.4 / S3.1 / S3.3 / S4.1 / S4.2 / S4.4 | D-001 · D-002 · D-003 · D-004 · D-005 · D-006 · D-007 · D-008 · **D-009 (S4.4 user sign-off Node ④)**. |
| `.ief/handoff.md` | (per Step) | Rewritten as `/ief-retro` packet by S4.4. |
| `.ief/lessons.md` | (P4) | Empty template; populated only in retrospective. |
| `data/series_inventory.md` | S1.1–S1.5 | Complete: §FRED (52) + §NYFed (5) + §Treasury (2) + §Appendix (whitelist) + §Final 66-row consolidated table + §P1 Wrap-up. |
| `tools/audit_proxy_registry.py` | S2.1 | Report-only audit; balanced JS parser; coverage + schema + D-001 classification; `--json` flag. |
| `tools/_jsparse.py` | S2.2 | Shared JS-aware balanced-block parser. |
| `tools/validate_registry_schema.py` | S2.3 | Strict D-002 validator: enums, chart_path existence, theory ≥50 中文字, last_updated ISO. |
| `data/proxy_validation_anchors.json` | S2.2 / S2.4 | 21-row candidate↔anchor mapping for live nodes; per-row anchor_rationale. |
| `data/proxy_validation.py` | S2.2 / S2.4 | Pure-stdlib empirical harness; SeriesStore loads FRED/NYFed/NYFed-PD/Treasury/OFR/CFTC; classify_registry by `primary: null` regex. |
| `data/json/proxy_empirical.json` | S2.2 / S2.4 | Flat 30-row summary {node_id: {corr_36m, chart_path, last_updated, sample_months, note}}. |
| `data/json/proxy_charts/*.json` | S2.2 / S2.3 / S2.4 | 32 per-node empirical detail files. |
| `data/ofr_config.py` | S2.4 | OFR REST API series catalog (5 mnemonics: 3 MMF + 2 repo). |
| `data/fetch_ofr_data.py` | S2.4 | OFR fetcher (`/v1/series/timeseries`); fail-soft; optional `OFR_API_KEY`. |
| `data/nyfed_pd_config.py` | S2.4 | NYFed Primary Dealer Statistics catalog (3 keyids: UST/agency/MBS net positions). |
| `data/fetch_nyfed_pd_data.py` | S2.4 | NYFed PD fetcher (`/api/pd/get/<keyid>.json`); 681 weekly obs each. |
| `data/cftc_config.py` | S2.4 | CFTC TFF Socrata catalog (3 contracts: UST 10Y NOTE / 2Y NOTE / BOND). |
| `data/fetch_cftc_data.py` | S2.4 | CFTC fetcher (Socrata pagination); 1037 rows each; long-short net by date. |
| `data/raw/ofr/*.json` | S2.4 | 5 OFR series caches. |
| `data/raw/nyfed_pd/*.json` | S2.4 | 3 NYFed PD series caches. |
| `data/raw/cftc/*.json` | S2.4 | 3 CFTC TFF contract caches. |
| `data/series_config.py` | S4.1 | FRED_SERIES (43 v1, byte-equivalent) + FRED_SERIES_V2 (12 v2, **+3 R008 entries: MBST/CURRCIR/H8B1058NCBCMG with corrected freq/units per D-007 Part B**). |
| `data/export_json.py` | S4.1 | Now exports both FRED_SERIES + FRED_SERIES_V2 ids in `time_series.json` and `series_metadata.json` (additive; v1 never indexes new keys). |
| `js/v2/proxy_registry.js` | S2.3 / S2.4 / S4.1 | D-002 canonical schema; 32/32 NODES; **S4.1 (D-007 Part C): bs_agency_mbs/bs_fed_notes lift to corr_36m=1.0; foreign_banks/us_fbo demoted to `primary: null` per concept-mismatch**; passes audit + strict validator 0 errors. |
| `js/v2/proxy_registry.js.s2.1.bak` | S2.3 | Pre-rewrite snapshot. |
| `js/v2/badges.js` | S3.2 / S3.3 / S3.4 | Top-center anchored proxy badges (D-005); D-002 alignment; stale + cross-source-violation kinds (D-006); **S3.4: `seriesValueAtOrBefore` + currentDate threading + `computeStaleness(referenceDate)` for sidebar-driven re-render**. |
| `js/v2/tooltip.js` | S3.2 / S3.3 | `showBadgeProxy(node, event, dataLoader, obsDate, extras)` — proxy 简写 + observation YYYY-MM + stale + violation rows. |
| `js/v2/value_format.js` | S3.3 | `formatValue(value, units, dataLoader)` — delegates to v1 formatter; fallback for rate/bps/USD billions. |
| `css/v2/diagram.css` | S3.2 / S3.3 | Adds `.proxy-badge-stale` (gray) + `.proxy-badge-violation` (amber) + `.tt-stale` / `.tt-violation` tooltip rows. |
| `js/v2/diagram.js` | S3.2 / S3.3 / S3.4 | `initDiagram` async-loads `cross_source_diff.json` (fail-soft); **S3.4: module-level `_ctx` cache + new export `updateBadges(currentDate)`**. |
| `js/v2/app.js` | S3.4 | v2 entry point; **S3.4: `wireTimeSelector` listens additively on `#date-select` (change) + `#date-slider` (input, 50 ms debounce) → `updateBadges`** — zero v1 modification. |

## Open Items
- **Open**: R005 / R007 / R008 / R010 / R011. **Mitigated**: R002 (S2.4 D-004) · R006 (S2.4 D-004) · **R003 (S3.1 D-005)**. **Closed**: R001 (S2.5) · R004 (S2.5) · R009 (S2.3 D-003 Part A). Progress notes:
  - **R003 mitigated** (S3.1): badge clearance audit shows 32/32 nodes accommodate height≤14 + pad≤3 above the node top edge; tightest = 12 BS-pitch nodes at 20 px exact. No Node ② needed; no node y-shift; no viewBox extension. S3.2 implementation must respect these dimensions.
  - **R005** verified: harness short-history fallback active for hedge_funds (96 < 153 samples in DVP repo data).
  - **R007** still open: amber-color choice for cross-source 5% violation needs S3.3 confirmation against existing v2 palette (no conflict expected; spec line 18 explicitly nominates amber).
  - **R008** still open: 3 FRED series absent from snapshots; D-003 Part B 採 Option B；S4.1 補拉。
  - **R010** still open (S2.5): Treasury TGA snapshot stale since 2022-04 — S4.1 backfill.
  - **R011** still open (S2.5): NYFed rrp_ops/srf_ops unit metadata mismatch — S4.1.
