# Plan — USD Liquidity Visualization Optimization (v2)

> Generated from `spec.md` v0.2.0. Update whenever a phase completes or scope changes.
> **Frozen** at version: 0.1.0 · Date: 2026-04-26 (User Node ② approved).

## Discovery Notes

代码库已具备的可复用资产（避免重复造轮子）：

1. **数据管线已通**：`data/fetch_fred_data.py` · `fetch_nyfed_data.py` · `fetch_treasury_data.py` 三个 fetcher + `build_database.py` (SQLite) + `export_json.py`（as-of 对齐）已成熟，`data/json/*.json` 9 个文件齐备。**配置已集中**于 `series_config.py` / `nyfed_config.py` / `treasury_config.py`。
2. **Proxy registry 雏形已存在**：[js/v2/proxy_registry.js](js/v2/proxy_registry.js) 已为 v2 中约 25 个冻结节点写入 `primary` / `secondary` / `rationale`；缺失字段：`empirical.corr_36m` / `chart_path` / `last_updated` / `script_path` / `units`（部分有），`alternates[]` 命名规范化。
3. **v2 渲染极薄**：[js/v2/nodes.js](js/v2/nodes.js) 直接 delegate 到 v1 `renderNodes`；[js/v2/badges.js](js/v2/badges.js) 现有浮动角标默认锺定在节点**右上角**。按 spec v0.2.0 Q12/Q13 修订，仅需将其**水平居中及错位到3节点正上方**，并为其加上 hover tooltip（proxy 简写 + 观测日期）。**节点本体渲染路径不动**（不再 fork v1 nodes.js）。
4. **白名单源 fetchers 尚无**：OFR / BIS / SIFMA / DTCC / ICI / SEC / IMF 当前在 `proxy_registry` 中标 `source: "External"` + `proxy_status: "external"|"partial"`，需 P2 内新增独立 fetcher 模块（`data/fetch_ofr_data.py` 等）。
5. **跨源差值 > 5% 颜色提醒**：现有架构无此机制；P2 末加一个 `data/cross_source_diff.py` 离线生成对照表，前端在 P3 渲染时读取。
6. **重叠已修复**：v2 节点重叠在 2026-04-26 上一项目已清零（`spec.md` Q10）；本项目 P3 几何变更须保不回归。
7. **画布 viewBox 2150×1280** 与 BALANCE SHEET 470×1175 子面板 — Q11 允许扩，但建议 P3.1 先做**角标净空间可行性评估**，能在现几何内容纳浮动角标再考虑 Node ② 扩 viewBox 或微调节点 y 坐标。
8. **Implementation discipline 上轮已落地**：`.ief/decisions.md` 模式已建立，沿用同样的方案/否决记录习惯。

## Phase Map

### Phase 1 — Data Inventory  · Acceptance: USER (Node ③)
**Goal**: 产出 `data/series_inventory.md`，覆盖 FRED / Treasury / NY Fed 三大来源全部入选序列；扩展白名单作为附录列出（仅清单 + 接入计划，不在本 Phase 内拉数据）。
**Exit criteria**: spec AC #1 满足；每个序列有可复现的 fetch 命令；inventory 已落库。

| Step | Title | Inputs | Outputs | Deps | Validation | Ctx Cost |
|---|---|---|---|---|---|---|
| 1.1 | FRED inventory & verify | `data/series_config.py`, `data/fetch_fred_data.py`, `data/json/series_metadata.json` | `data/series_inventory.md` §FRED 部分 | — | auto: 跑一次 `fetch_fred_data.py` smoke + human 校对 | M |
| 1.2 | NY Fed inventory & verify | `data/nyfed_config.py`, `data/fetch_nyfed_data.py`, `data/raw/nyfed/*.json` | `data/series_inventory.md` §NYFed 部分 | — | auto: smoke `fetch_nyfed_data.py` + human | M |
| 1.3 | Treasury inventory & verify | `data/treasury_config.py`, `data/fetch_treasury_data.py`, `data/raw/treasury/*.json` | `data/series_inventory.md` §Treasury 部分 | — | auto: smoke `fetch_treasury_data.py` + human | M |
| 1.4 | Whitelist source scoping | spec §Constraints, `proxy_registry.js` 中所有 `source: External` 节点 | `data/series_inventory.md` §附录 + `decisions.md` D-001 (whitelist 入选 + 凭证策略) | 1.1, 1.2, 1.3 | human: 列表完整性 | L |
| 1.5 | Consolidate inventory table | 1.1–1.4 outputs | `data/series_inventory.md` 终稿（统一格式：来源 · 名称/标识 · 频率 · 获取方式 · 脚本路径） | 1.1, 1.2, 1.3, 1.4 | human + AC#1 check | L |

**Phase 1 Acceptance**: 用户 Node ③ — 看 `series_inventory.md` 完整性，签字进入 P2。

---

### Phase 2 — Proxy Matching & Validation  · Acceptance: USER (Node ③)
**Goal**: 为 v2 冻结节点清单（`js/v2/constants.js` 节点 ID 全集）每一项确定主+备 proxy；产出实证验证（月度对齐、滚动 36 个月相关系数）；找不到的明确 `primary: null` + `reason`。
**Exit criteria**: spec AC #2 / #3 满足；每个节点条目含 `empirical.corr_36m` 或显式 `not_applicable` 标记。

| Step | Title | Inputs | Outputs | Deps | Validation | Ctx Cost |
|---|---|---|---|---|---|---|
| 2.1 | Audit registry vs frozen node list | `js/v2/constants.js` 派生的 node ID 全集, `js/v2/proxy_registry.js` 现状 | `decisions.md` D-002 (节点缺口表 + 命名 schema 决策) + 一个 `tools/audit_proxy_registry.py` | 1.5 | auto: audit 脚本输出 0 错 | L |
| 2.2 | Empirical validation harness | `data/json/time_series.json`, `pressure_indicators.json`, etc. + spec §Constraints (36M monthly window) | `data/proxy_validation.py` 脚本 + `data/json/proxy_empirical.json`（每节点 corr_36m + 走势图路径） | 2.1 | auto: 脚本可跑通；human 抽样查 3 个节点的相关图 | H |
| 2.3 | Primary/alternate assignment | 2.2 outputs + 现有 `proxy_registry.js` rationale | 改写后的 `js/v2/proxy_registry.js` v2 schema（含 `primary` / `alternates[]` / `theory` / `empirical` / `last_updated` / `script_path`） + `decisions.md` D-003 (各节点选 primary 的取舍) | 2.2 | auto: schema 校验脚本；human review | M |
| 2.4 | Whitelist fetchers for not-found gaps | `proxy_registry.js` 中 `primary: null` / `external` 节点 + 1.4 入选源 + `.env` (OFR key 等) | 新增 `data/fetch_ofr_data.py` / `fetch_bis_data.py` 等（按需）+ 对应 raw JSON + 更新 `proxy_registry.js` | 2.3 | auto: smoke 拉一遍；human 校 corr_36m | H |
| 2.5 | Cross-source diff detection | 2.3 输出 + 同概念跨源序列对照表 | `data/cross_source_diff.py` + `data/json/cross_source_diff.json`（每个跨源点的 `relative_diff_pct` + `priority_source`） | 2.3 | auto: 跑一次离线生成；human 抽 3 个差值 > 5% 的点核对 | M |

**Phase 2 Acceptance**: 用户 Node ③ — 抽样审 5 个节点的 theory + corr_36m + chart 是否合理，签字进入 P3。

**Parallelism within P2**: 2.4 与 2.5 互不写同一文件，可并行（先各自起 Step，最后合并入 `proxy_registry.js`）。

---

### Phase 3 — Layout Optimization & Floating Badge Re-anchor  · Acceptance: USER (Node ③)
**Goal**: 保留现有浮动角标机制，将其从节点右上角改为水平居中于节点正上方；为角标增加 hover tooltip（proxy source · series id + 观测 `YYYY-MM`）；v2 节点本体渲染路径不动（v1 渲染零改动）；保不破坏 v2 已修复的不重叠状态。
**Exit criteria**: spec AC #4 / #5 / #6 / #7 / #8 满足；如需微调节点纵坐标或扩 viewBox 已在 3.1 走过 Node ② 申请。

| Step | Title | Inputs | Outputs | Deps | Validation | Ctx Cost |
|---|---|---|---|---|---|---|
| 3.1 | Badge collision feasibility study | `js/v2/badges.js`（现有 anchor 逻辑）, `js/constants.js` SECTIONS / 节点几何, 2.3 输出（每节点最大数值字符估算） | `decisions.md` D-004（结论：A. 现几何下上方有足够 vertical clearance；B. 某些节点需微调 y 坐标；C. 需扩 viewBox → **触发 Node ② 申请**） | 2.3 | human: 对顶部靠近 section 标题 / annotation 的节点逐个检查上方净空间 | M |
| 3.2 | Re-anchor badge to top-center + hover tooltip | 3.1 决策 + `js/v2/badges.js`（现状）+ `proxy_registry.js`（proxy 简写 + last_updated）+ `js/tooltip.js`（v1 hover 复用） | 改写 [js/v2/badges.js](js/v2/badges.js)：anchor 从 `(x+hw-6, y-hh+4)` 改为 `(x, y-hh-PADDING)`，`text-anchor` 改 `middle`；为 `<g class="proxy-badge">` 子节点追加 `<title>` 或挂 mousemove 调用 `js/tooltip.js`；`css/v2/diagram.css` 调中间对齐样式。**不再 fork v1 nodes.js**（[js/v2/nodes.js](js/v2/nodes.js) 保持薄包装） | 3.1 | human 看 v2 + 自动：v1 视觉 diff = 0（v1 不加载 badges.js） | M |
| 3.3 | Value formatting + stale + cross-source color | `data/json/cross_source_diff.json` (2.5), `proxy_registry.js`, `js/v2/badges.js` | `js/v2/value_format.js`（金额 $1.23T / 利率 4.32% / bps 整数）+ stale 灰显（阈值：日 7d / 周 21d / 月 60d，写入 `decisions.md` D-005）+ 琥珀色高亮逻辑（写入 badges 的 fill / class） | 3.2, 2.5 | auto: 单元级 console 测试（在 app 启动时跑几个 sanity assert）；human 看色 | M |
| 3.4 | Wire to sidebar time selector + hover YYYY-MM | `js/sidebar.js` / `js/time-selector.js` 现有 onChange 钩子；`js/v2/badges.js` (3.3) | v2 数据流闭环：sidebar 改日期 → badges 重渲染 → hover 角标显示 `proxy source · series id` + 对应观测 `YYYY-MM` | 3.3 | human: 拖动时间轴看角标数值变化；hover 看 tooltip | M |

**Phase 3 Acceptance**: 用户 Node ③ — 浏览器内拖动时间，看 v2 全节点上方角标数值正确切换、stale 灰显、跨源色提醒；hover 角标看到 proxy 简写 + YYYY-MM；v1 tab 切回去逐像素无差。签字进入 P4。

**Inline checkpoints within P3**:
- After 3.1: 若结论是 B（需改节点坐标）或 C（需扩 viewBox）→ 立即 Node ② 申请，等用户批准再继续 3.2。
- After 3.2: v1 视觉零回归是硬阈值；不达就回到 3.2 而非前进。

---

### Phase 4 — Integration & Acceptance  · Acceptance: USER (Node ④ — final sign-off)
**Goal**: 端到端跑通；浏览器验收；retro 准备。
**Exit criteria**: spec AC #1–#12 全部满足，无 console 错。

| Step | Title | Inputs | Outputs | Deps | Validation | Ctx Cost |
|---|---|---|---|---|---|---|
| 4.1 | Pipeline E2E rerun | data/ 全部 fetcher + build + export | 刷新后的 `data/json/*.json` + `data/proxy_empirical.json` + `cross_source_diff.json` | 3.4 | auto: 看每个 JSON 的 mtime + size | L |
| 4.2 | Visual regression check | v1/v2 两 tab 浏览器截屏对比 (上一冻结视觉 vs 现状) | `decisions.md` D-006（截图对照结论） | 4.1 | human: v1 像素级一致 / v2 无新重叠 | M |
| 4.3 | Browser console pass | Chrome / Safari 桌面最新版 | `decisions.md` D-007（console 截图：error=0, warning=0） | 4.2 | human | L |
| 4.4 | User sign-off (Node ④) | 4.1–4.3 outputs | `decisions.md` D-008（用户验收记录）+ `state.md` 更新 | 4.3 | USER | L |
| 4.5 | Retrospective prep | 全 Phase artifacts | `lessons.md` 草稿 + 触发 `/ief-retro` 建议 | 4.4 | — | L |

**Phase 4 Acceptance**: 用户 Node ④ — final sign-off。完成后建议运行 `/ief-retro` 关闭 R001–R007。

---

## Parallelism

- **P1**: 1.1 / 1.2 / 1.3 互相独立，可并行（不同 config / fetcher / raw 子目录）。
- **P2**: 2.4 与 2.5 共享 `proxy_registry.js` 写入，但写入区域可解耦（2.4 改 entry，2.5 仅读后写新 JSON）→ 可并行实现，最后合并 commit。其余 Step 串行。
- **P3**: 全部串行（视觉/几何强依赖前序）。
- **P4**: 全部串行。

## Estimated Context Budget

| Phase | Σ Ctx Cost | 备注 |
|---|---|---|
| P1 | M+M+M+L+L = ~Mid | 单会话可完成 |
| P2 | L+H+M+H+M = ~High | **建议在 2.2 与 2.4 各开新对话**（数据序列回归 + 外源 fetcher 各自吞 context） |
| P3 | M+M+M+M = ~Mid | 重构范围缩小（不再 fork v1 nodes.js），可在单会话内完成 | 
| P4 | L+M+L+L+L = ~Low | 单会话 |

**Fresh-conversation checkpoints**: 进入 S2.2 / S2.4 时分别开新对话；P3 重构范围缩小，已不需为 S3.2 单独开新会话。

## Plan Version History
| Version | Date | Trigger |
|---|---|---|
| 0.1.0-draft | 2026-04-26 | Initial draft after spec v0.1.0 freeze |
| 0.1.0-draft (rev) | 2026-04-26 | Re-aligned with spec v0.2.0 (centered floating badge + hover subtitle); P3 scope shrunk; awaiting Node ② |
| 0.1.0 | 2026-04-26 | Frozen after User Node ② approval |
