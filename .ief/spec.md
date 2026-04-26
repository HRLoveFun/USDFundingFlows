# Spec — USD Liquidity Visualization Optimization (v2)

> **Frozen** at version: 0.2.0 · Date: 2026-04-26
> Mutation rule: any change requires explicit unfreeze (drift → scope change), version bump, and re-freeze.
> v0.2.0 reverts the Q12/Q13 resolution per user instruction (drift branch C): proxy values render as a centered floating badge above each node; the proxy short-name moves from an in-node subtitle to a hover tooltip on that badge.

## Goal
优化 USD Funding Flows 项目的 v2 可视化模块，使其能够清晰、准确地呈现美元流动性的传导路径并定位潜在堵点。具体而言：(a) 系统梳理 FRED · U.S. Treasury · NY Fed 三个权威 API 中与美元流动性相关的时间序列；(b) 为 v2 中**当前 `js/v2/constants.js` 已冻结**的每个流动性概念节点匹配一个有理论与实证支撑的代理变量（proxy，主+备结构，仅显示主）；(c) 在节点形状内部不动 v1 label 的前提下，将代理变量数值渲染为一个**水平居中、紧贴节点上方**的浮动角标；proxy 简写不再以副标题形式出现在节点内，而是作为该角标的 hover tooltip；(d) 在已修复重叠的基础上，确保新增角标显示不引入新的视觉冲突。最终交付一个"概念—代理变量—数值"三层一一对应、布局美观、可复现的可视化模块；v1 视觉不变，仅被动共享 proxy 数据基础设施。

## Scope — IN
- 梳理并产出 FRED / Treasury / NY Fed 三大来源与美元流动性相关的时间序列 inventory，列：数据来源 · 数据名称/标识 · 时间频率 · 获取方式 · 脚本路径。
- 验证每个序列获取方式（API 端点 / 直接下载 / 既有脚本）已跑通，留存可复现命令。
- 为 v2 当前节点清单中每个概念节点匹配最相关的代理变量（主 proxy 必填、备 proxy 可选），附：(i) 理论逻辑论证；(ii) 实证数据验证（月度对齐、滚动 36 个月相关系数 / 走势对比）。
- 三大来源未覆盖时，扩大到白名单（OFR / BIS / SIFMA / DTCC / ICI / SEC / IMF）及实现者按需补充的其它公开来源；允许使用免费注册凭证（如 OFR API key）；仍找不到时显式标注 `proxy: null` + `reason`。
- 在 `js/v2/proxy_registry.js` 维护 `节点 ID → {primary, alternates[], theory, empirical, ...}` 的映射。
- 代理变量数值显示规范：跟随 sidebar 时间选择器取值，频率不匹配时**取最近一次观测**；hover 显示对应观测的 `YYYY-MM`；缺失或 stale > 阈值时显示**灰色历史值 + `stale` 标记**。
- 数值格式：金额 `$1.23T`/`$987.65B`/`$45.6M`、利率 `4.32%`、基点 `25 bps`（整数带单位）。
- 三大来源同一概念存在重叠时按 **FRED → NY Fed → Treasury** 优先级取主源；若同一时点跨源相对差值 > 5%，在显示值上以颜色（如琥珀色）提醒并在 tooltip 标出差异来源与差值。
- v2 节点上方以**水平居中的浮动角标**显示代理变量当前数值；节点本体保留 v1 原 label，不引入副标题；proxy 简写（来源 / series id）作为该角标的 hover tooltip。如角标位置侵占其他节点或顶部 section 边界，触发 Node ② 申请微调几何或扩 `viewBox`。
- v1 模块**视觉零变化**，但允许被动消费 `proxy_registry.js` / 同一份 `data/json/` 数据，以保持数据底座统一。
  - **(v0.2.1 修订, S4.2 / D-008)** 上述「v1 视觉零变化」放宽为「v1 节点拓扑（id 集合 / 概念语义）保持冻结，但允许结构性微调（节点 shape / x / y / parentId / indent flag）以**修复**或**消除**几何冲突，前提是：(i) 调整后通过 D-005 ≥17 px clearance 审计；(ii) 不新增 / 删除节点；(iii) 不扩 viewBox；(iv) 不改边路由拓扑；(v) 在 decisions.md 记录调整内容与几何审计结果。S4.2 已据此接受 bs_liabilities 列扁平化（bs_rrp_omo / bs_foreign_repo / bs_tga / bs_fhlb_deposits 由 bs_child→bs_parent + indent: true，bullet-prefix 渲染，新增 dash_rrp_group + dash_other_liab_group 两个虚线包裹）。
- 将 proxy 选择理由、否决项、跨源差异处理策略沉淀到 `.ief/decisions.md` 与 README。

## Scope — OUT
- 不改造 v1 模块的布局、样式、节点拓扑或视觉表现。**(v0.2.1 修订, D-008)** 例外：允许在严格条件下（D-005 重审 / 不动 viewBox / 不动边拓扑 / 在 decisions.md 落册）做几何**冲突修复**性质的微调，主要为修正 S3.1 D-005 审计未覆盖的潜在重叠。
- 不改 v2 当前 `constants.js` 中的节点 ID / 拓扑 / 概念语义（节点清单冻结）。
- 不引入额外的浮动**卡片**元素（card / popover 这类多行容器）；保留原有的轻量级浮动**角标**（badge，单值短文本）作为唯一的浮动元素。
- 不引入新的可视化框架、构建系统或前端依赖。
- 不重构 `data/build_database.py` 数据库 schema；仅按需扩展 `series_config.py` / `treasury_config.py` / `nyfed_config.py` 与对应 fetch 脚本，并新增白名单源的独立 fetch 模块。
- 不引入需要付费凭证的数据源（Bloomberg / Refinitiv 等）。
- 不引入实时（流式 / WebSocket）数据更新；保持 JSON 快照模式。
- 不做移动端响应式 / 国际化 / 无障碍专项增强。
- 不做 proxy 选定的逐项用户评审环节（实现者自决，最终在 Phase 验收时统一审）。

## Constraints
- 技术栈固定：原生 ES modules + D3 v7 + 静态 CSS，无构建步骤；Python 3 用于 `data/` 脚本。
- 画布 SVG 当前 `viewBox="0 0 2150 1280"`；如必须扩大须在 plan.md 显式说明并经 Node ② 通过。
- 数据来源优先级：FRED → NY Fed → Treasury；扩展来源（OFR/BIS/SIFMA/DTCC/ICI/SEC/IMF/其它）须在 `decisions.md` 记录入选理由。
- 实证验证标准：**月度对齐、滚动 36 个月相关系数**为基准窗口；阈值由实现者基于概念性质自决并在 `decisions.md` 中说明，但每个 proxy 必须给出 `corr_36m` 数值。
- 跨源差异阈值：相对差值 > 5% 触发颜色提醒。
- 代理结构：每节点 1 个主 proxy + 0..N 备选；UI 仅显示主。
- 角标几何：单值短文本，水平居中于节点正上方；与节点边界保持固定垂直间距；禁止新增多行卡片 / popover 容器。
- Implementation discipline：仅做必要变更；任何方案选择与否决理由写入 `.ief/decisions.md`，未解事项写入 `.ief/risks.md`。
- IEF 流程（Node ①…⑥、quality gate、drift triage）继续适用。

## Acceptance Criteria
1. `data/series_inventory.md`（或 `.csv`）已产出，覆盖 FRED / Treasury / NY Fed 三来源全部入选序列，列含：数据来源 · 名称/标识 · 频率 · 获取方式 · 脚本路径；扩展来源（白名单）入选项作为附录列出。
2. v2 当前 `constants.js` 中每个概念节点在 `js/v2/proxy_registry.js` 都有条目；条目字段至少含：`node_id`、`primary: {proxy_id, source, frequency, units}`、`alternates: [...]`、`theory`（≥50 字中文）、`empirical: {window: "36M_monthly", corr_36m, chart_path}`、`last_updated`、`script_path`。
3. 找不到合适代理的节点显式置 `primary: null` 并附 `reason` 字段。
4. v2 每个节点上方渲染一个水平居中的浮动角标，内容为该节点 primary proxy 的当前数值（金额/利率/bps 按规范格式化）；hover 该角标时显示 tooltip：proxy 简写（source · series id）+ 该数值对应的观测 `YYYY-MM`；节点本体保留 v1 原 label，不新增副标题；除该角标外不引入其他浮动容器。
5. 数值取值跟随 sidebar 时间选择器；频率不匹配时取最近一次观测；缺失 / stale 超阈值时呈灰色 + `stale` 标记。
6. 当同一概念跨源相对差值 > 5% 时，主显示值以指定颜色（如琥珀色）高亮，tooltip 中列出各源数值与差值。
7. v2 中任意两个可见节点的边框矩形不发生像素级重叠（相切允许）；任一边的端点位于其连接节点边界上 — 维持当前已修复的重叠状态，新增数值显示不引入回归。
8. 现有 v1/v2 时间选择器、sidebar、tooltip、tab 切换不被破坏；v1 视觉相对修复前在节点 id / 概念 / 拓扑 / viewBox / 边路由层面无差异（仅允许 proxy 数据基础设施被动共享 + **(v0.2.1) 经 D-005 重审通过的几何冲突修复**）。
9. v2 在 Chrome / Safari 最新桌面浏览器渲染无新增 console error / warning。
10. 阶段交付按 P1=数据梳理+inventory · P2=proxy 匹配+验证 · P3=布局优化+卡片渲染 · P4=集成验收。
11. 所有改动文件、proxy 选择理由、否决项、跨源差异处理策略记录在 `.ief/decisions.md`；inception 风险记录在 `.ief/risks.md`。
12. 验收：用户本地肉眼 + 浏览器 console 检查通过。

## Known Risks at Inception
- R001: FRED / NY Fed / Treasury 在 EFFR、SOFR、RRP 等序列上重叠，口径与发布时点差异需识别；跨源 5% 差值规则需要稳定的对齐与单位换算。
- R002: 部分概念节点（如离岸美元、影子流动性）在三大公共来源中可能没有合适代理，需扩展白名单或留空。
- R003: 浮动角标水平居中放置在节点上方时，可能与上方相邻节点 / section 标题 / annotation 文字发生垂直重叠，特别是在 BALANCE SHEET 列内紧密排布的 `bs_parent` 节点之间，可能触发 Node ② 申请微调节点纵坐标或扩 `viewBox`。
- R004: proxy 频率（日 / 周 / 月）与时间选择器粒度不一致时虽规定取最近一次观测，但"最近"窗口阈值（stale 判定）尚未量化。
- R005: 实证验证（滚动 36 个月相关系数）对短历史序列（如 SRF、新设立的 NY Fed 工具）窗口不足，需替代方法。
- R006: 白名单中 OFR / BIS 等来源依赖外部网络与免费 key，CI / 复现性会引入新故障点。
- R007: 跨源差值颜色提醒可能与 v2 现有 pressure / liquidity 视觉编码语义冲突，需选定不冲突的色相。

## Open Questions Resolved at Bootstrap
| # | Question | Resolution | Date |
|---|---|---|---|
| Q1 | v2 概念节点清单是否冻结？ | 冻结现有 `js/v2/constants.js`，本项目不增删节点。 | 2026-04-26 |
| Q2 | v1 与 v2 隔离程度？ | v1 视觉零变化，但可被动共享 `proxy_registry.js` 与 `data/json/` 数据基础设施。 | 2026-04-26 |
| Q3 | 实证验证标准？ | 月度对齐、滚动 36 个月相关系数；阈值由实现者按概念性质自决并在 decisions.md 中说明，每个 proxy 必须报告 corr_36m。 | 2026-04-26 |
| Q4 | 是否允许多个候选 proxy？ | 主 + 备结构；UI 仅显示主。 | 2026-04-26 |
| Q5 | 卡片数值显示什么？ | 跟随 sidebar 时间选择器取值；hover 显示对应观测 YYYY-MM。 | 2026-04-26 |
| Q6 | 频率不匹配处理？ | 取最近一次观测。 | 2026-04-26 |
| Q7 | 跨源优先级与差异处理？ | FRED → NY Fed → Treasury；同时点相对差值 > 5% 时显示值用颜色（琥珀色等）提醒，tooltip 列出差值。 | 2026-04-26 |
| Q8 | 扩展数据源白名单？ | OFR / BIS / SIFMA / DTCC / ICI / SEC / IMF；实现者可按需补充并在 decisions.md 备案。 | 2026-04-26 |
| Q9 | 是否允许免费注册凭证？ | 允许。 | 2026-04-26 |
| Q10 | v2 当前重叠状态？ | 重叠已在上一项目修复完成；本项目须维持该状态，不得回归。 | 2026-04-26 |
| Q11 | 是否允许扩 viewBox？ | 允许，但须经 Node ② 通过；优先在现有几何内解决。 | 2026-04-26 |
| Q12 | 是否允许新增浮动卡片？ | **(v0.2.0 修订)** 多行卡片不允许；保留单值短文本的浮动角标作为唯一浮动元素，水平居中放置在节点正上方。 | 2026-04-26 |
| Q13 | 节点文字结构？ | **(v0.2.0 修订)** 节点本体保留 v1 原 label，不新增副标题；proxy 简写（source · series id）作为浮动角标的 hover tooltip 显示。 | 2026-04-26 |
| Q14 | 数值格式？ | 金额 $1.23T / 利率 4.32% / 基点 整数 + bps。 | 2026-04-26 |
| Q15 | 缺失 / stale 显示？ | 灰色历史值 + `stale` 标记。 | 2026-04-26 |
| Q16 | 验收方式？ | 用户本地肉眼 + console 检查。 | 2026-04-26 |
| Q17 | 阶段拆分？ | P1 数据梳理+inventory / P2 proxy 匹配+验证 / P3 布局优化+卡片渲染 / P4 集成验收。 | 2026-04-26 |
| Q18 | 是否逐项评审 proxy？ | 实现者自决；Phase 末统一接受用户验收。 | 2026-04-26 |

## Version History
| Version | Date | Reason | Reference |
|---|---|---|---|
| 0.1.0 | 2026-04-26 | Initial freeze after User Node ① resolutions | — |
| 0.2.0 | 2026-04-26 | Drift branch C (scope change): user revoked Q12/Q13 in-node two-row layout; switched to centered floating badge + hover tooltip for proxy short-name. Plan re-draft required. | User instruction in conversation; not yet at Node ② |
| 0.2.1 | 2026-04-26 | Drift branch C (scope relaxation, S4.2): Q2 / Scope-OUT-1 / AC#8 amended — v1 “逐像素无差异”放宽为“拓扑 / viewBox / 边路由不变”，允许几何冲突修复性微调。启用改动：bs_liabilities 列扁平化 (bs_child→bs_parent + indent flag + bullet 渲染 + 2 个 dash_*_group)。全部 32 个 registry 节点 D-005 audit 重跑：0 violations / 12 tight @ 20 px 与原 BS-pitch 一致。 | User Node ② 口头接受 "Path B" 2026-04-26; D-008 记录 |
