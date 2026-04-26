# USD Funding Flows — 优化实施方案（Claude Code 执行手册）

> 本文档面向 Claude Code 直接执行。每个模块独立可并行，模块内部按文件路径与任务清单组织，含关键代码片段。
>
> **执行约定**：
> - 所有路径以仓库根 `USDFundingFlows/` 为基准
> - 任务以 `- [ ]` 形式列出，完成一项后改为 `- [x]`
> - 涉及修改既有文件时，先 `git diff` 确认改动范围
>
> **验收策略**：仅设两个**强制验收节点**——
> 1. **数据拉取后**（Module A 结束）：检查 JSON 完整性与派生指标条数
> 2. **布局重构后**（Module B 结束）：浏览器视觉核对面板/虚线组/边路由
>
> 其他模块（C/D/E）只做轻量自检，不阻塞流程。

---

## 0. 项目目标与输出

### 0.1 总体目标

把现有"水位图"升级为**美元流动性传导地图 + 价差压力指示**，以 NY Fed 2019 原图为基线，扩展：

1. **数据底座**：补全 FRED 系列、新增 Treasury Fiscal Data 与 NY Fed Markets API 双数据源；
2. **proxy 映射**：每个节点 / 每条连线绑定权威代理变量，附理论与实证依据；
3. **新版布局**：双面板（FED Balance Sheet | USD Funding Market）+ 嵌套虚线分组；
4. **新增连线**：SRF、Discount Window、Foreign RRP Pool；
5. **价差通道（P1）**：每条边叠加"量 + 价"双指标；
6. **压力探针面板（P2，单独里程碑）**：七大堵点指示器。

### 0.1.1 ⚠️ 架构总约束：原图必须保留（双标签隔离）

> **本约束高于一切模块要求。** 任何改动一旦违反此处规则即视为方案偏离。

- 原图（NY Fed 2019 复刻版）作为 **v1 基线**，**所有源文件保持当前状态不动**——`js/*.js`、`css/*.css`、`index.html` 中的 v1 渲染逻辑均不可修改、不可删除
- 新功能全部在 **v2 命名空间** 实现：`js/v2/*.js`、`css/v2/*.css`、独立的 SVG 容器
- 用户通过页面顶部 Tab 切换 v1 / v2，**首次打开默认 v1**（避免改动惊吓既有用户）
- 数据层 **纯追加**：原 `data/json/*.json` 文件输出口径不变；新数据写入新文件
- v1 渲染路径任何回归（节点位置、边样式、tooltip 文案变化）都视为 release blocker

### 0.1.2 ⚠️ v2 视觉基线 = v1（必须）

> 实施过程中发现：B 阶段把 plan 中给的"草案坐标"当作权威，结果 v2 渲染出与 v1 完全不同的节点集，是错误的。本节做明确约束。

- **v2 默认视觉等价 v1**：v2 Tab 第一次完成（即 Module B 验收）时，v2 SVG 中的面板/分组/节点的**数量、位置、形状、文字、颜色必须与 v1 完全一致**——只是缺少边、缺少侧边栏、缺少时间选择器
- **数据复用**：`js/v2/constants.js` 用 `import { NODES } from "../constants.js"` 直接 re-export v1 的 NODES；`js/v2/layout/panels.js` 同理 re-export v1 的 SECTIONS / ANNOTATIONS。**不允许** v2 自己写一套坐标
- **渲染复用**：v2 的 `renderSections` / `renderNodes` 在 S2 阶段直接调用 v1 的同名函数（薄壳转发）。后续模块要替换某个节点的视觉时，**fork 这个 wrapper**，**不修改 v1 的实现**
- **增量原则**：要"加 SRF / Discount Window / Foreign RRP Pool" 这类 v2 独有的节点/边，由 Module C（追加节点）/ Module E（追加边）完成；它们 push 到 NODES 副本而不是 v1 原数组
- **plan §3.2 中 B2 的"节点坐标草案"是历史笔记，不再是权威**——以本节约束为准

### 0.1.3 ⚠️ S2 阶段不渲染任何边

> 历史 plan 把"路由工具"和"边渲染"放在同一阶段（B4/B5），易混淆。本节明确切分。

- **S2（Module B）只渲染**：面板（panels）、分组（sections / dashed groups）、节点（nodes）
- **S2 不渲染**：连线（edges）、端点（ports）、proxy 徽章、价差通道、压力指示器
- `js/v2/constants.js` 的 `EDGES` 在 S2 阶段保持 `[]`；`js/v2/layout/routing.js` 仅作为**路由工具函数**（`routeManhattan` / `routeBezier` / `pickRouter` / `applyBundleOffset`）输出，不被任何活动调用点触发
- 端点选择（port selection）属于 `edge_routing_interface_design.md` 的 `endpoint-selector` 范畴，由 Module C 落地
- 边的 path 数据由 Module C（绑定 proxy）+ Module E（新连线）共同填充 `EDGES`，再由 v2 的 `renderEdges` 调用 routing 工具绘制

### 0.2 并行工作流总览

```
                  ┌──── Module 0：双标签架构搭建 ────┐
                  │   index.html Tab 容器 + v2 入口    │
                  │   v1 渲染路径冻结（不可改）         │
                  └────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────── Module A：数据管线扩容 ────────┐
                │   FRED 补全 → Treasury → NY Fed       │
                │   ⚠ 原 JSON 输出不变，新数据写新文件    │
                └────────────────┬───────────────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────────────┐
       │                         │                                 │
┌──────▼──────┐         ┌────────▼────────┐               ┌────────▼────────┐
│ Module B    │         │ Module C        │               │ Module E         │
│ v2 布局     │ ←─独立─→│ v2 proxy 映射 +  │   ←依赖A的─→  │ v2 新连线        │
│（双面板）   │         │ 节点/边数据绑定   │   完成 outputs│                  │
│ 路径=js/v2/ │         │ 路径=js/v2/      │               │ 路径=js/v2/      │
└─────────────┘         └─────────────────┘               └──────────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Module D (P1) │  v2 价差通道（仅 v2 边渲染）
                         └───────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Module F (P2) │  v2 压力探针 dashboard
                         └───────────────┘
```

**并行关系**：
- **Module 0 必须最先完成**——它定义了所有 v2 代码的存放位置与挂载方式
- **A、B 完全独立**：数据扩容与 SVG 布局重构不冲突，可同时启动
- **C 依赖 A 的产物**：需要新数据 JSON 才能在 v2 `constants.js` 里绑定
- **E 依赖 A**：新边的数据来自 A 新拉取的系列
- **D 依赖 A + C**：需要价差数据 + 已绑定 proxy 的边
- **F 推迟到独立里程碑**

---

## 1. Module 0 — 双标签架构搭建（最先执行）

> **必须最先完成**。本模块产出 v1 / v2 共存的"骨架"，之后所有模块都在 v2 容器内填肉。

### 1.0.1 设计原则

| 维度 | v1（原图） | v2（优化版） |
|---|---|---|
| 入口 SVG ID | `#diagram-svg` | `#diagram-svg-v2` |
| JS 入口 | `js/app.js`（**不动**） | `js/v2/app.js`（新建） |
| 节点/边定义 | `js/constants.js`（**不动**） | `js/v2/constants.js` |
| 渲染模块 | `js/nodes.js`、`js/edges.js`、`js/diagram.js`（**不动**） | `js/v2/*` |
| 样式 | `css/main.css`、`diagram.css`（**仅追加 Tab 样式，不改原 class**） | `css/v2/*` |
| 数据加载 | `js/data-loader.js`（可共享，**只读不改**） | 共享 v1 的 dataLoader 实例 |
| 配置常量 | `js/config.js`（**不动**） | `js/v2/config.js`（独立尺寸/颜色） |

**共享 vs 独立的判断标准**：
- 工具函数（数值格式化、日期解析）→ 共享 v1 现有实现
- 任何涉及视觉/布局/数据绑定的模块 → 必须 fork 到 v2 命名空间

### 1.0.2 输出文件

```
index.html                  # 修改：新增 Tab 容器 + v2 SVG 占位
css/v2/                     # 新建目录
└── main.css                # v2 专属样式入口（@import 子模块）
js/v2/                      # 新建目录
├── app.js                  # v2 入口：初始化、挂载 SVG、注入数据
├── config.js               # v2 视觉/布局配置（独立于 v1）
├── constants.js            # v2 节点/边定义（依赖 Module B-E 填充）
├── diagram.js              # v2 协调器
├── nodes.js                # v2 节点渲染
├── edges.js                # v2 连线渲染
├── tooltip.js              # v2 tooltip
├── sidebar.js              # v2 侧边栏（如需独立）
└── layout/                 # 由 Module B 填充
js/
└── tab-router.js           # 新建：Tab 切换逻辑（v1/v2 共用）
```

### 1.0.3 任务清单

#### 0.1 `index.html` 注入 Tab 容器

- [x] 在现有 SVG 容器外层包裹 Tab 结构。**只追加，不删除既有节点**：

```html
<!-- index.html — 在 <body> 内，原 #diagram 容器之前插入 -->
<div class="tab-bar">
  <button class="tab-btn active" data-tab="v1">
    NY Fed Original (2019)
  </button>
  <button class="tab-btn" data-tab="v2">
    Optimized View — Liquidity + Pressure
    <span class="tab-badge-new">NEW</span>
  </button>
</div>

<!-- v1 容器：包裹原有 #diagram 内容 -->
<div class="tab-pane active" data-pane="v1">
  <!-- 原有 #diagram、侧边栏、控件全部保留在这里，结构不变 -->
</div>

<!-- v2 容器：新建，初始隐藏 -->
<div class="tab-pane" data-pane="v2" hidden>
  <div id="diagram-v2-root">
    <svg id="diagram-svg-v2" viewBox="0 0 2000 1280"
         preserveAspectRatio="xMidYMid meet"></svg>
    <aside id="sidebar-v2"></aside>
    <div id="time-selector-v2"></div>
  </div>
</div>

<!-- 模块加载顺序：v1 先（保持原行为），v2 后（且 lazy） -->
<script type="module" src="js/app.js"></script>
<script type="module" src="js/tab-router.js"></script>
```

> ⚠️ 把现有 `<div id="diagram">` 整个搬进 `<div class="tab-pane active" data-pane="v1">` 里时，**只移动外层包裹，内部任何节点都不可改 ID/class**。否则 v1 的 D3 选择器会断。

#### 0.2 Tab 切换逻辑

- [x] 新建 `js/tab-router.js`：

```javascript
// js/tab-router.js
// 极简 Tab 路由：仅管理 v1/v2 显示切换，不动 v1 渲染
const STORAGE_KEY = "usdff-active-tab";

let v2Loaded = false;

async function ensureV2Loaded() {
  if (v2Loaded) return;
  // 动态 import 避免首屏阻塞 v1
  const { initV2 } = await import("./v2/app.js");
  await initV2();
  v2Loaded = true;
}

function activate(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    const match = p.dataset.pane === tab;
    p.classList.toggle("active", match);
    p.hidden = !match;
  });
  if (tab === "v2") ensureV2Loaded();
  localStorage.setItem(STORAGE_KEY, tab);
}

function init() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });
  // 默认 v1，但记住用户上次选择
  const saved = localStorage.getItem(STORAGE_KEY);
  activate(saved === "v2" ? "v2" : "v1");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

#### 0.3 `js/v2/app.js` 入口骨架

- [x] 新建 `js/v2/app.js`，先打通"空 SVG 能加载"：

```javascript
// js/v2/app.js
import { DataLoader } from "../data-loader.js";  // 共享 v1 的数据加载器
import { initDiagram } from "./diagram.js";

let initialized = false;

export async function initV2() {
  if (initialized) return;
  const svg = document.getElementById("diagram-svg-v2");
  if (!svg) throw new Error("[v2] SVG container missing");

  // 共享 dataLoader 实例（v1 已加载过的数据可复用）
  const dataLoader = window.__v1DataLoader || new DataLoader();
  await dataLoader.ready;
  window.__v2DataLoader = dataLoader;

  initDiagram(svg, dataLoader);
  initialized = true;
  console.log("[v2] initialized");
}
```

- [x] 在 `js/app.js`（**v1 入口，仅追加一行**）末尾暴露 dataLoader：

```javascript
// js/app.js — 末尾追加（不修改任何既有逻辑）
window.__v1DataLoader = dataLoader;
```

> 这是允许的最小幅度 v1 改动——只是把已有变量暴露到 window。如果不愿意改，v2 自行 `new DataLoader()` 也行（多一次数据加载）。

#### 0.4 占位 v2 模块

为了让 Module 0 自检通过，先建空壳，让 Module B-E 后续填充：

- [x] `js/v2/diagram.js`：导出 `initDiagram(svg, dataLoader)`，内部仅画一个 placeholder 矩形 + 文字 "v2 渲染就绪，等待 Module B 注入布局"
- [x] `js/v2/config.js`：先空导出 `export const CONFIG = {}`
- [x] `js/v2/constants.js`：先空导出 `export const NODES = []; export const EDGES = [];`
- [x] `js/v2/nodes.js` / `edges.js` / `tooltip.js` / `sidebar.js`：均空模块，预留导出函数签名

#### 0.5 Tab 样式

- [x] 新建 `css/v2/main.css` 入口（暂时为空）
- [x] 在 **`css/main.css`** 追加（这是 v1 文件唯一允许的改动，仅加 Tab UI，不改既有 class）：

```css
/* css/main.css 追加 —— Tab 样式（仅追加，不改既有规则） */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 16px 0;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}
.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  color: #666;
}
.tab-btn:hover { color: #222; }
.tab-btn.active {
  background: #fff;
  border-color: #d0d0d0;
  color: #111;
  font-weight: 600;
  position: relative;
  top: 1px;  /* 视觉对齐边框 */
}
.tab-badge-new {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 10px;
  background: #ff7f0e;
  color: #fff;
  border-radius: 8px;
  font-weight: 700;
}
.tab-pane[hidden] { display: none; }
.tab-pane.active { display: block; }
```

- [x] 在 `index.html` 的 `<head>` 中追加 `<link rel="stylesheet" href="css/v2/main.css">`

### 1.0.4 ⭐ Module 0 验收（强制）

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

**通过条件（全部满足）**：
1. 默认显示 v1 Tab，**原图渲染与改造前完全一致**——节点位置、颜色、tooltip、侧边栏、时间选择器无任何变化
2. 点击 "Optimized View" Tab，显示 v2 占位文字 / placeholder 矩形
3. v1 / v2 切换不报错；切换后 v1 再切回，渲染保持稳定
4. console 无新增 error / warning
5. 关闭浏览器重开，记住上次 Tab 选择

> **若 v1 出现任何视觉差异，立即停止后续模块，回到 0.1-0.5 修复。**

---

## 2. Module A — 数据管线扩容（仅追加，禁删改）

> **本模块在 `data/` 目录扩展 Python 流水线**。最重要的约束：**原 JSON 文件输出口径不变**——v1 前端依赖的 `time_series.json` 等文件，新流水线运行后必须生成与改造前**字节级或字段级一致**的内容。新数据写入新文件。

### 2.0 ⚠️ 纯追加规则

| 操作 | 是否允许 |
|---|---|
| 在 `series_config.py` 的 `FRED_SERIES` 字典追加新 key | ✅ |
| 修改 `FRED_SERIES` 中**已有 key** 的值 | ❌ |
| 在 SQLite 新建表 | ✅ |
| 修改既有表 schema（增删列、改类型） | ❌ |
| 在 `export_json.py` 新增 export 函数与新 JSON 文件 | ✅ |
| 修改既有 export 函数 → 改变原 JSON 输出 | ❌ |
| 删除 `time_series.json` 中任一原有系列 | ❌ |

### 2.1 目标

- 在现有 FRED 流水线基础上，新增 ~15 个核心系列；
- 新增独立的 **Treasury Fiscal Data** 拉取脚本（免认证 REST）；
- 新增独立的 **NY Fed Markets API** 拉取脚本（免认证 REST，含日内分位数）；
- 三类数据归一化进入同一个 SQLite 库 → 导出独立 JSON 文件供 v2 消费，**不动 v1 已用 JSON**。

### 2.2 输出文件

```
data/
├── series_config.py          # 仅追加新 key 到 FRED_SERIES
├── treasury_config.py        # 新建
├── nyfed_config.py           # 新建
├── fetch_fred_data.py        # 仅追加（兼容新 key），不改既有逻辑
├── fetch_treasury_data.py    # 新建
├── fetch_nyfed_data.py       # 新建
├── build_database.py         # 追加新表 + 派生指标计算，原 schema 不动
├── export_json.py            # 追加 export_*_v2() 函数，原函数不改
└── json/                     # v1 文件保持不变；新增 4 个 v2 文件
    ├── available_dates.json    # ← v1 既有，输出口径不变
    ├── raw_observations.json   # ← v1 既有，输出口径不变
    ├── series_metadata.json    # ← v1 既有，输出口径不变
    ├── time_series.json        # ← v1 既有，输出口径不变
    ├── fed_balance_sheet.json     # 新增（v2 专用）
    ├── treasury_flows.json        # 新增（v2 专用）
    ├── nyfed_operations.json      # 新增（v2 专用）
    └── pressure_indicators.json   # 新增（v2 专用）
```

### 2.3 任务清单

#### A1. 扩充 FRED 系列配置

- [x] 修改 `data/series_config.py`，按下列分组新增字段：

```python
# data/series_config.py — 新增片段（追加到既有 FRED_SERIES）
FRED_SERIES_NEW = {
    # === Fed 资产负债表 ===
    "WALCL":      {"label": "Fed Total Assets",          "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "WRESBAL":    {"label": "Reserve Balances",          "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "WTREGEN":    {"label": "TGA (weekly)",              "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "WLRRAL":     {"label": "Total Reverse Repo",        "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "WLCFLPCL":   {"label": "Discount Window — PC",      "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "WLCFOCEL":   {"label": "BTFP Outstanding",          "freq": "W", "unit": "USD M",  "group": "fed_bs"},
    "H41RESPPALDKNWW": {"label": "CB Liquidity Swaps",   "freq": "W", "unit": "USD M",  "group": "fed_bs"},

    # === 货币市场利率走廊 ===
    "IORB":       {"label": "Interest on Reserve Balances", "freq": "D", "unit": "%",   "group": "rates"},
    "EFFR":       {"label": "Effective FFR",                "freq": "D", "unit": "%",   "group": "rates"},
    "SOFR":       {"label": "SOFR",                         "freq": "D", "unit": "%",   "group": "rates"},
    "OBFR":       {"label": "OBFR",                         "freq": "D", "unit": "%",   "group": "rates"},
    "TGCR":       {"label": "Tri-party GC Repo",            "freq": "D", "unit": "%",   "group": "rates"},
    "BGCR":       {"label": "Broad GC Repo",                "freq": "D", "unit": "%",   "group": "rates"},

    # === 商票 / MMF ===
    "DCPF1M":     {"label": "1M Financial CP",   "freq": "D", "unit": "%",     "group": "cp"},
    "DCPN30":     {"label": "1M Non-fin CP",     "freq": "D", "unit": "%",     "group": "cp"},
    "COMPAPER":   {"label": "CP Outstanding",    "freq": "W", "unit": "USD M", "group": "cp"},

    # === 银行 ===
    "TOTBKCR":    {"label": "Bank Credit (H.8)", "freq": "W", "unit": "USD B", "group": "bank"},
    "DTB4WK":     {"label": "4W T-Bill Yield",   "freq": "D", "unit": "%",     "group": "treasury_rates"},
    "DTB3":       {"label": "3M T-Bill Yield",   "freq": "D", "unit": "%",     "group": "treasury_rates"},
}

# 合并到主映射
FRED_SERIES.update(FRED_SERIES_NEW)
```

- [x] 在文件头部加入 `group` 字段说明，方便 `export_json.py` 按组导出
- [x] 跑 `python3 fetch_fred_data.py --series-only WRESBAL,SOFR,IORB` 验证新增系列可拉取

#### A2. Treasury Fiscal Data 拉取脚本

- [x] 新建 `data/treasury_config.py`：

```python
# data/treasury_config.py
TREASURY_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"

TREASURY_ENDPOINTS = {
    "tga_daily": {
        "path": "/v1/accounting/dts/operating_cash_balance",
        "fields": ["record_date", "account_type", "close_today_bal"],
        "filter_template": "record_date:gte:{start_date}",
        "freq": "D",
        "label": "TGA Daily Balance",
    },
    "auctions": {
        "path": "/v1/accounting/od/auctions_query",
        "fields": ["auction_date", "security_type", "security_term",
                   "high_yield", "bid_to_cover_ratio", "total_accepted"],
        "filter_template": "auction_date:gte:{start_date}",
        "freq": "irregular",
        "label": "Treasury Auctions",
    },
    "marketable": {
        "path": "/v1/accounting/od/marketable_securities_outstanding",
        "fields": ["record_date", "security_type_desc", "total_mil_amt"],
        "filter_template": "record_date:gte:{start_date}",
        "freq": "M",
        "label": "Marketable Securities Outstanding",
    },
}
```

- [x] 新建 `data/fetch_treasury_data.py`：

```python
# data/fetch_treasury_data.py
"""
Treasury Fiscal Data API — 免认证 REST 拉取
免费 / 无 API key / JSON 直出
"""
import json
import time
from pathlib import Path
from datetime import date
import requests
from treasury_config import TREASURY_BASE, TREASURY_ENDPOINTS

OUT_DIR = Path(__file__).parent / "raw" / "treasury"
OUT_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_START = "2013-01-01"
PAGE_SIZE = 10000


def fetch_endpoint(name: str, start_date: str = DEFAULT_START) -> list[dict]:
    cfg = TREASURY_ENDPOINTS[name]
    url = f"{TREASURY_BASE}{cfg['path']}"
    rows: list[dict] = []
    page = 1
    while True:
        params = {
            "fields": ",".join(cfg["fields"]),
            "filter": cfg["filter_template"].format(start_date=start_date),
            "page[size]": PAGE_SIZE,
            "page[number]": page,
            "format": "json",
        }
        resp = requests.get(url, params=params, timeout=60)
        resp.raise_for_status()
        payload = resp.json()
        rows.extend(payload.get("data", []))
        meta = payload.get("meta", {})
        total_pages = meta.get("total-pages", 1)
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.2)  # 友好节流
    return rows


def main():
    for name in TREASURY_ENDPOINTS:
        print(f"[treasury] fetching {name} ...")
        rows = fetch_endpoint(name)
        out = OUT_DIR / f"{name}.json"
        out.write_text(json.dumps(rows, indent=2))
        print(f"[treasury] saved {len(rows)} rows → {out}")


if __name__ == "__main__":
    main()
```

- [x] 验收：`python3 data/fetch_treasury_data.py` 执行成功，`data/raw/treasury/tga_daily.json` 有 ≥ 3000 行（约 13 年日数据）

#### A3. NY Fed Markets API 拉取脚本

- [x] 新建 `data/nyfed_config.py`：

```python
# data/nyfed_config.py
NYFED_BASE = "https://markets.newyorkfed.org/api"

NYFED_ENDPOINTS = {
    "sofr": {
        "path": "/rates/secured/sofr/search.json",
        "params": {"startDate": "2018-04-02"},  # SOFR 起点
        "freq": "D",
        "fields_keep": ["effectiveDate", "percentRate",
                        "percentPercentile1", "percentPercentile25",
                        "percentPercentile75", "percentPercentile99",
                        "volumeInBillions"],
    },
    "effr": {
        "path": "/rates/unsecured/effr/search.json",
        "params": {"startDate": "2013-01-01"},
        "freq": "D",
        "fields_keep": ["effectiveDate", "percentRate",
                        "percentPercentile1", "percentPercentile99",
                        "volumeInBillions"],
    },
    "rrp_ops": {
        "path": "/rp/reverserepo/propositions/search.json",
        "params": {"startDate": "2013-01-01"},
        "freq": "D",
        "fields_keep": ["operationDate", "totalAmtAccepted",
                        "totalAmtSubmitted", "acceptedCounterparties"],
    },
    "srf_ops": {
        "path": "/rp/repo/propositions/search.json",
        "params": {"startDate": "2021-07-28"},  # SRF 起点
        "freq": "D",
        "fields_keep": ["operationDate", "totalAmtAccepted",
                        "totalAmtSubmitted", "acceptedCounterparties"],
    },
    "soma_summary": {
        "path": "/soma/summary.json",
        "params": {},
        "freq": "W",
        "fields_keep": ["asOfDate", "totalSOMAHoldings"],
    },
}
```

- [x] 新建 `data/fetch_nyfed_data.py`：

```python
# data/fetch_nyfed_data.py
"""NY Fed Markets API 拉取（免认证）"""
import json
from pathlib import Path
import requests
from nyfed_config import NYFED_BASE, NYFED_ENDPOINTS

OUT_DIR = Path(__file__).parent / "raw" / "nyfed"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_endpoint(name: str) -> list[dict]:
    cfg = NYFED_ENDPOINTS[name]
    url = f"{NYFED_BASE}{cfg['path']}"
    resp = requests.get(url, params=cfg["params"], timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    # NY Fed 返回结构因端点而异：rates 在 refRates，operations 在 repo/operations
    candidates = ("refRates", "repo", "operations", "soma")
    for k in candidates:
        if k in payload:
            data = payload[k]
            if isinstance(data, dict):
                # operations 端点：再下钻到 operations 列表
                data = data.get("operations") or data.get("holdings") or []
            return data
    return payload.get("data", [])


def filter_fields(rows: list[dict], keep: list[str]) -> list[dict]:
    return [{k: r.get(k) for k in keep if k in r} for r in rows]


def main():
    for name, cfg in NYFED_ENDPOINTS.items():
        print(f"[nyfed] fetching {name} ...")
        rows = fetch_endpoint(name)
        rows = filter_fields(rows, cfg["fields_keep"])
        out = OUT_DIR / f"{name}.json"
        out.write_text(json.dumps(rows, indent=2))
        print(f"[nyfed] saved {len(rows)} rows → {out}")


if __name__ == "__main__":
    main()
```

> ⚠️ NY Fed API 端点的响应结构在不同 endpoint 略有差异。第一次跑完先 `head -c 1000 data/raw/nyfed/sofr.json` 检查实际字段名，必要时调整 `fields_keep`。

- [x] 验收：`data/raw/nyfed/sofr.json` 至少包含 `percentPercentile99` 字段

#### A4. 数据库 schema 扩展

- [x] 修改 `data/build_database.py`，新增三张表：

```sql
-- 在 build_database.py 的 schema 初始化部分追加
CREATE TABLE IF NOT EXISTS treasury_observations (
    record_date  TEXT NOT NULL,
    series_name  TEXT NOT NULL,
    sub_category TEXT,
    value        REAL,
    PRIMARY KEY (record_date, series_name, sub_category)
);

CREATE TABLE IF NOT EXISTS nyfed_observations (
    record_date  TEXT NOT NULL,
    series_name  TEXT NOT NULL,
    metric       TEXT NOT NULL,    -- rate / pct99 / volume / counterparties
    value        REAL,
    PRIMARY KEY (record_date, series_name, metric)
);

CREATE TABLE IF NOT EXISTS derived_indicators (
    record_date  TEXT NOT NULL,
    indicator    TEXT NOT NULL,    -- sofr_iorb_spread / effr_iorb_spread / pct99_med_gap
    value        REAL,
    PRIMARY KEY (record_date, indicator)
);
```

- [x] 增加加载函数 `load_treasury()` 与 `load_nyfed()`，从 `raw/` 目录读取 JSON 写入 SQLite
- [x] 增加派生指标计算：

```python
# build_database.py
def compute_derived_indicators(conn):
    """在已有日频数据基础上计算关键 spread 与分位数差"""
    cur = conn.cursor()
    cur.execute("DELETE FROM derived_indicators")

    # SOFR - IORB spread（bps）
    cur.execute("""
        INSERT INTO derived_indicators (record_date, indicator, value)
        SELECT s.record_date, 'sofr_iorb_spread_bps',
               ROUND((s.value - i.value) * 100, 2)
        FROM nyfed_observations s
        JOIN (SELECT record_date, value FROM observations WHERE series_id='IORB') i
          ON s.record_date = i.record_date
        WHERE s.series_name='sofr' AND s.metric='rate'
    """)

    # SOFR p99 - median（bps）
    cur.execute("""
        INSERT INTO derived_indicators (record_date, indicator, value)
        SELECT a.record_date, 'sofr_p99_median_gap_bps',
               ROUND((a.value - b.value) * 100, 2)
        FROM nyfed_observations a
        JOIN nyfed_observations b
          ON a.record_date = b.record_date
        WHERE a.series_name='sofr' AND a.metric='pct99'
          AND b.series_name='sofr' AND b.metric='rate'
    """)

    # ΔTGA 5d
    cur.execute("""
        INSERT INTO derived_indicators (record_date, indicator, value)
        SELECT t1.record_date, 'tga_delta_5d_usd_b',
               ROUND((t1.value - t2.value) / 1000.0, 2)
        FROM treasury_observations t1
        LEFT JOIN treasury_observations t2
          ON t2.record_date = date(t1.record_date, '-5 days')
         AND t2.series_name = t1.series_name
        WHERE t1.series_name='tga_daily'
    """)
    conn.commit()
```

#### A5. JSON 导出扩展

- [x] 修改 `data/export_json.py`，新增四个导出函数：
  - `export_fed_balance_sheet()` → `fed_balance_sheet.json`
  - `export_treasury_flows()` → `treasury_flows.json`
  - `export_nyfed_operations()` → `nyfed_operations.json`
  - `export_pressure_indicators()` → `pressure_indicators.json`

- [x] **关键**：原 `time_series.json`、`available_dates.json` 等 v1 文件**输出不变**——v2 新数据全部走新增 export 函数

### 2.4 验收（Module A，强制）

```bash
cd data

# 0. 拉取前先备份原 JSON（用于事后字节级比对）
cp -r json json.before_v2

# 1. 全量拉取
python3 fetch_fred_data.py
python3 fetch_treasury_data.py
python3 fetch_nyfed_data.py
# 2. 入库
python3 build_database.py
# 3. 导出 JSON
python3 export_json.py

# 4. 验收 A：v1 既有 JSON 必须未变（字节级或字段级一致）
python3 -c "
import json, pathlib
v1_files = ['available_dates.json','raw_observations.json',
            'series_metadata.json','time_series.json']
for f in v1_files:
    before = json.loads(pathlib.Path('json.before_v2',f).read_text())
    after  = json.loads(pathlib.Path('json',f).read_text())
    assert before == after, f'❌ v1 文件 {f} 输出已改变！违反纯追加规则'
    print(f'[OK v1 unchanged] {f}')
"

# 5. 验收 B：v2 新文件齐全
python3 -c "
import json, pathlib
v2_files = ['fed_balance_sheet.json','treasury_flows.json',
            'nyfed_operations.json','pressure_indicators.json']
for f in v2_files:
    p = pathlib.Path('json')/f
    assert p.exists(), f'缺失 {f}'
    print(f'[OK v2 created] {f} {p.stat().st_size//1024}KB')
"
```
    p = pathlib.Path('json')/f
    assert p.exists(), f'缺失 {f}'
    data = json.loads(p.read_text())
    print(f'[OK] {f} keys={list(data)[:3]} size_kb={p.stat().st_size//1024}')
"
```

**通过条件**：
- v1 既有 4 个 JSON 与备份完全一致（验收 A 不报 AssertionError）
- v2 新增 4 个 JSON 齐全
- `pressure_indicators.json` 中 `sofr_iorb_spread_bps` 至少 1500 行

---

## 3. Module B — 双面板布局重构（与 A 完全并行）

> **路径约定**：所有产物在 `js/v2/` 与 `css/v2/`。**不修改任何 v1 文件**。
> **范围约束**：见 §0.1.2（v2 视觉等价 v1）与 §0.1.3（S2 不渲染边）。
> **关键参考**：用户提供的面板层级（Section Tree）

```
├─ 左侧面板：FEDERAL RESERVE (520×1220, level=1)
│  └─ BALANCE SHEET (470×1175, level=2)
│     ├─ Assets 列
│     └─ Liabilities 列
│
└─ 右侧面板：U.S. DOLLAR FUNDING MARKET (1420×1220, level=1)
   ├─ ONSHORE ENTITIES (940×1175, level=2)
   │  ├─ Banks and Dealers (905×300, level=3)
   │  │  └─ [虚线 dash_banks_pair: U.S. Banks + U.S. Branches]
   │  ├─ Onshore Investors (905×520, level=3)
   │  │  ├─ [虚线 dash_mmf_row: Gov MMF + Prime MMF]
   │  │  └─ [虚线 dash_investor_group: Sec Lenders + Corporates + FCBs/SWFs + HF]
   │  └─ U.S. Government Entities (905×230, level=3)
   │     └─ [虚线 dash_gse_pair: FHLB + GSEs]
   │
   └─ OFFSHORE ENTITIES (260×1175, level=2)
      └─ [虚线 offshore_investors: Foreign Insurers + Foreign Banks + Corporates]
```

> ✅ **此层级与 v1 `js/constants.js` 中的 `SECTIONS` 数组结构相同**——v2 的层级数据**直接 re-export v1 SECTIONS**，不要在 v2 里重写一份。

### 3.1 输出文件

```
js/v2/
├── layout/                    # 新建子目录
│   ├── panels.js              # re-export v1 SECTIONS / ANNOTATIONS（薄壳）
│   └── routing.js             # 路由工具函数（S2 阶段仅工具，不被调用）
├── constants.js               # 填充：re-export v1 NODES；EDGES = []
├── diagram.js                 # 填充：调用 v1 renderSections + v1 defineMarkers + v2 renderNodes
├── nodes.js                   # 填充：薄壳，转发到 v1 renderNodes
└── edges.js                   # 填充：renderEdges 函数（S2 阶段 EDGES=[] → 实际不绘制）
css/v2/
└── diagram.css                # 新建：保持空（S2 仅继承 v1 的 css/diagram.css）
```

> ⚠️ **不修改任何 v1 文件**。Module 0 已建立 `js/v2/*.js` 空壳，本模块只是填充内容。
> ⚠️ **v1 文件可以 read-only `import`**——这不属于"修改 v1"。Plan 中"v1 不动"的约束指的是不能编辑 v1 源代码本身。

### 3.2 任务清单

#### B1. v2 数据层 = v1 re-export

- [x] `js/v2/constants.js`：

```javascript
import { NODES as V1_NODES } from "../constants.js";
export const NODES = V1_NODES;
export const EDGES = [];   // S2 阶段必须为空，由 Module C/E 填充
```

- [x] `js/v2/layout/panels.js`：

```javascript
import { SECTIONS, ANNOTATIONS } from "../../constants.js";
export const PANELS = SECTIONS;
export { ANNOTATIONS };
export const DASH_GROUPS = SECTIONS.filter(s => s.style === "dashed_gray");
```

> ❌ **不要**根据本文档 §3 顶部 ASCII 树自己重写一套 PANELS 字典。v1 的 SECTIONS 数组是唯一权威。

#### B2. v2 渲染 = 调用 v1 渲染器

- [x] `js/v2/diagram.js`：

```javascript
import { renderSections } from "../nodes.js";   // v1 read-only
import { defineMarkers }  from "../edges.js";   // v1 read-only
import { renderNodes }    from "./nodes.js";    // v2 wrapper
import { renderEdges }    from "./edges.js";    // v2 wrapper
import { NODES, EDGES }   from "./constants.js";

export function initDiagram(svgEl, _dataLoader) {
  const sel = window.d3.select(svgEl);
  sel.selectAll("*").remove();
  const root         = sel.append("g").attr("class", "v2-root");
  const defs         = root.append("defs");
  const sectionLayer = root.append("g").attr("class", "section-layer");
  const edgeLayer    = root.append("g").attr("class", "edge-layer");
  const nodeLayer    = root.append("g").attr("class", "node-layer");

  defineMarkers(defs);
  renderSections(sectionLayer);
  renderEdges(edgeLayer.node(), EDGES, NODES);  // EDGES=[] → no-op in S2
  renderNodes(nodeLayer);
}
```

- [x] `js/v2/nodes.js`：

```javascript
import { renderNodes as renderV1Nodes } from "../nodes.js";
export function renderNodes(layer, opts = {}) {
  return renderV1Nodes(layer, {
    onNodeHover: opts.onNodeHover ?? (() => {}),
    onNodeOut:   opts.onNodeOut   ?? (() => {}),
  });
}
```

- [x] `index.html`：v2 `<svg id="diagram-svg-v2">` 的 `viewBox` 与 v1 画布一致：`viewBox="0 0 2150 1280"`

#### B3. 路由工具（S2 仅写函数，不调用）

- [x] `js/v2/layout/routing.js`：导出 `routeManhattan(s, t, opts)` / `routeBezier(s, t, opts)` / `pickRouter(s, t)` / `applyBundleOffset(edges)` 四个**纯函数**
- [x] **S2 阶段不在 v2/edges.js 真正使用这些函数**——`EDGES=[]` 时 renderEdges 直接 return；存在的代码路径仅供 Module C/E 接管时使用

> ⚠️ **plan 旧版 B4/B5 的"边路由 + 边束捆绑"**已被剥离到 Module C/D/E。S2 验收**不**检查"边不穿节点 / 跨面板贝塞尔"——因为 S2 没有边。

#### B4. CSS 处理

- [x] `css/v2/diagram.css` 在 S2 阶段保持**几乎为空**——v2 直接继承 v1 的 `css/diagram.css`（这些规则的 selector 大部分是 `g.node`、`g.section` 等全局选择器，对 v2 SVG 同样生效）
- [x] 仅在确实需要 v2-only overlay 时（如 proxy 徽章、价差通道，将由 Module C/D 完成）才追加规则

### 3.3 验收（Module B / S2）

```bash
# 启动本地服务
python3 -m http.server 8000
# 在浏览器打开 http://localhost:8000，硬刷新（Cmd+Shift+R）后切到 "Optimized View" Tab
```

**通过标准**（视觉对比）：
1. v2 Tab 显示的面板/分组/虚线框/节点 **与 v1 完全一致**——同样的 28 节点（6 hexagon + 11 circle + 1 rectangle + 14 bs_parent/bs_child）
2. 节点形状、文字、颜色与 v1 像素级等同
3. v2 不显示**任何**连线（无箭头、无 path）——这是 S2 的预期，不是缺陷
4. v2 不显示侧边栏 / 时间选择器 / 顶部 header（这些由 Module C/D/G 接入）
5. 切回 v1 Tab，v1 渲染未受影响（无任何回归）

**不通过的常见原因**：
- 浏览器缓存：硬刷新（Cmd+Shift+R / Ctrl+F5）
- v2 引入了自己重写的 PANELS / NODES：违反 §0.1.2，必须改回 re-export
- v2 渲染器没调用 v1 的 renderSections/renderNodes：参考 §3.2 B2 的代码骨架



> **本节（B1–B6 历史草案）已被 §3.2 上方的新任务清单替代。** 之前的草案给出了一套独立的节点坐标 / 路由实现，与 §0.1.2（v2 视觉等价 v1）冲突，故归档。需要 v2 边/路由细节请看 Module C / D / E。

---

## 3. Module C — Proxy 映射与节点/边数据绑定（依赖 A）

### 3.1 输出文件

```
js/
├── constants.js            # 修改：每个节点/边追加 proxy 字段
└── proxy_registry.js       # 新建：proxy → series_id 中央映射
docs/
└── proxy_mapping.md        # 新建：人类可读的 proxy 论证表
```

### 3.2 任务清单

#### C1. Proxy 注册表

- [x] 新建 `js/v2/proxy_registry.js`：

```javascript
// js/v2/proxy_registry.js
// 节点 / 边 → 数据系列的中央映射表
// 每条记录：primary 主 proxy / secondary 备选 / rationale 理论依据 / source 数据源

export const NODE_PROXIES = {
  fed_reserves: {
    primary:    { source: "FRED", series: "WRESBAL", freq: "W", unit: "USD M" },
    secondary:  { source: "FRED", series: "WALCL",   freq: "W" },
    rationale:  "准备金是 Fed 向银行体系净注入的存量；ΔWRESBAL 与 SOFR-IORB 在 QT 期 ρ≈-0.4",
  },
  fed_tga: {
    primary:    { source: "Treasury", series: "tga_daily", freq: "D" },
    secondary:  { source: "FRED", series: "WTREGEN", freq: "W" },
    rationale:  "TGA 上升等于从私人部门抽水；ΔTGA vs ΔWRESBAL 在中性期 ρ≈-0.7~-0.9",
  },
  fed_rrp_liab: {
    primary:    { source: "FRED", series: "RRPONTSYD", freq: "D" },
    secondary:  { source: "NYFed", series: "rrp_ops",  freq: "D" },
    rationale:  "ON RRP 余额 + 参与机构数；后者为领先指标",
  },
  fed_lending: {
    primary:    { source: "FRED", series: "WLCFLPCL", freq: "W" },
    rationale:  "Discount Window 一级信贷余额；stigma 抑制下任意非零都是信号",
  },
  fed_swaplines: {
    primary:    { source: "FRED", series: "H41RESPPALDKNWW", freq: "W" },
    rationale:  "央行流动性互换；危机时（2020-3、2023-3）显著上升",
  },

  us_banks: {
    primary:    { source: "FRED", series: "TOTBKCR", freq: "W" },
    rationale:  "H.8 总信贷代表银行资产端规模；存款流出会推高对批发市场依赖",
  },
  us_branches: {
    primary:    { source: "FRED", series: "H8B1058NCBCMG", freq: "W" },
    rationale:  "FBO 在美无零售存款，依赖 FX swap + IORB 套利，是 RRP 边际玩家",
  },
  broker_dealers: {
    primary:    { source: "NYFed", series: "primary_dealer_stats",
                  freq: "W", note: "NY Fed 网页 CSV，非 API" },
    rationale:  "Dealer Net UST Coupon Position 是 SLR 容量的直接代理",
    proxy_status: "partial",  // 数据需手工下载
  },

  gov_mmf: {
    primary:    { source: "OFR",   series: "mmf_govt_aum", freq: "M",
                  note: "OFR MMF 月报，非 API" },
    secondary:  { source: "FRED", series: "MMMFFAQ027S", freq: "Q" },
    rationale:  "Govt MMF AUM 与 ON RRP 余额 ρ>0.85（2021-2023）",
    proxy_status: "partial",
  },
  prime_mmf: {
    primary:    { source: "OFR",   series: "mmf_prime_aum", freq: "M" },
    rationale:  "Prime MMF 是 CP / Eurodollar 主要需求方",
    proxy_status: "partial",
  },

  treasury: {
    primary:    { source: "Treasury", series: "tga_daily",  freq: "D" },
    secondary:  { source: "Treasury", series: "auctions",   freq: "irregular" },
    rationale:  "TGA + 拍卖中标利率 + Bid-to-Cover 共同刻画发行节奏",
  },
  fhlb: {
    primary:    { source: "External", series: "fhlb_of_monthly",
                  note: "FHLB Office of Finance 月报，需爬取或手工" },
    rationale:  "FHLB 短债发行是无担保货币市场最大单一供给；2019/9 减持准备金引爆",
    proxy_status: "external",
  },
  gses: {
    primary:    { source: "External", series: "fhfa_gse_holdings",
                  note: "FHFA 月报" },
    rationale:  "GSE 在 fed funds 是无 IORB 资格的折价卖方，决定 EFFR-IORB 利差",
    proxy_status: "external",
  },

  hedge_funds: {
    primary:    { source: "OFR",   series: "cleared_repo_sponsored", freq: "W" },
    secondary:  { source: "CFTC",  series: "tff_treasury_net_short", freq: "W" },
    rationale:  "2021+ cash-futures basis trade 使 HF 成为美债最大边际买方",
    proxy_status: "partial",
  },
  dfmu: {
    primary:    { source: "OFR",   series: "ficc_gsd",   freq: "W" },
    rationale:  "2024 SEC central clearing 后 FICC 成为美债强制清算节点",
    proxy_status: "partial",
  },
  fcb_swf: {
    primary:    { source: "FRED",  series: "WLRRAL", freq: "W",
                  note: "Foreign Repo Pool 含在反向回购总额中" },
    rationale:  "外国央行通过 NY Fed 做美元逆回购，离岸美元蓄水池",
  },
  corporates: {
    primary:    { source: "FRED",  series: "COMPAPER", freq: "W" },
    rationale:  "非金融 CP 净发行 vs DCPN30-OIS 反向关系",
  },
  sec_lenders: {
    primary:    { source: "NYFed", series: "seclending", freq: "D",
                  note: "SOMA Securities Lending" },
    rationale:  "证券借贷量反映 cash-vs-collateral 失衡",
    proxy_status: "partial",
  },
  foreign_insurers:    { proxy_status: "not_found",
    rationale:  "无公开日/周频时间序列；可考虑 NAIC 季报间接代理" },
  foreign_banks:       { primary: { source: "FRED", series: "H8B1058NCBCMG", freq: "W" } },
  offshore_corporates: { proxy_status: "not_found",
    rationale:  "离岸美元企业现金管理无公开数据" },
};

export const EDGE_PROXIES = {
  // === 量 + 价双数据 ===
  fed_funds: {
    volume_proxy: { source: "NYFed", series: "effr", metric: "volume" },
    price_proxy:  { source: "Derived", series: "effr_iorb_spread_bps" },
    rationale:  "EFFR 量小（$70-120B），价差才是信号；< -10bp 提示 GSE 压价",
  },
  triparty_repo: {
    volume_proxy: { source: "OFR",   series: "triparty_volume" },
    price_proxy:  { source: "Derived", series: "tgcr_iorb_spread_bps" },
    rationale:  "$4-5T 体量；TGCR 持续 > IORB 提示银行准备金需求大",
    proxy_status: "partial",
  },
  bilateral_repo: {
    volume_proxy: { source: "OFR",   series: "cleared_bilateral_repo" },
    price_proxy:  { source: "Derived", series: "bgcr_tgcr_spread_bps" },
    rationale:  "bilateral 走阔 → dealer balance sheet 紧",
    proxy_status: "partial",
  },
  sponsored_repo: {
    volume_proxy: { source: "OFR",   series: "cleared_repo_sponsored" },
    price_proxy:  { source: "Derived", series: "sofr_p99_median_gap_bps" },
    rationale:  "sponsored 量是 HF 杠杆代理；99th 跳升预示尾部承压",
    proxy_status: "partial",
  },
  on_rrp: {
    volume_proxy: { source: "FRED",  series: "RRPONTSYD" },
    price_proxy:  { source: "Derived", series: "rrp_tbill4w_spread_bps" },
    counterparties_proxy: { source: "NYFed", series: "rrp_ops",
                             metric: "acceptedCounterparties" },
    rationale:  "价差为正→MMF 留 RRP；负→流出进 Bill；参与机构数领先 1-2 个月",
  },
  srf: {
    volume_proxy: { source: "NYFed", series: "srf_ops",
                     metric: "totalAmtAccepted" },
    price_proxy:  { source: "Derived", series: "srf_sofr_p99_gap_bps" },
    rationale:  "平时为 0；任意非零都是危险信号（2024-9-30、2024-12-31 已现）",
  },
  discount_window: {
    volume_proxy: { source: "FRED",  series: "WLCFLPCL" },
    price_proxy:  { source: "Derived", series: "pcr_iorb_spread_bps" },
    rationale:  "stigma 抑制；2023-3 SVB 周飙至 $150B+",
  },
  commercial_paper: {
    volume_proxy: { source: "FRED",  series: "COMPAPER" },
    price_proxy:  { source: "FRED",  series: "DCPF1M" },
    rationale:  "DCPF1M-OIS > 50bp 是企业短期融资压力点",
  },
  fx_swaps: {
    volume_proxy: { source: "FRED",  series: "H41RESPPALDKNWW" },
    price_proxy:  { source: "External", series: "eur_usd_3m_basis",
                     note: "Bloomberg / FRBNY G.5" },
    rationale:  "FX basis < -50bp = 离岸压力；2020-3、2022-9、2023-3 均先于 SOFR",
    proxy_status: "partial",
  },
  treasury_issuance: {
    volume_proxy: { source: "Treasury", series: "auctions",
                     metric: "total_accepted" },
    price_proxy:  { source: "Treasury", series: "auctions",
                     metric: "high_yield" },
    rationale:  "T-Bill 中标 - ON RRP rate 是 RRP 余额方向的根本驱动",
  },
  iorb_corridor: {
    volume_proxy: { source: "FRED",  series: "WRESBAL" },
    price_proxy:  { source: "FRED",  series: "IORB" },
    rationale:  "IORB 与 ON RRP rate 构成走廊；触底=资金过剩，触顶=资金紧",
  },

  // === 标记为未找到的边 ===
  eurodollar: {
    proxy_status: "not_found",
    rationale:  "LIBOR 2023-6 退出后无日频离岸量；BIS LBS 季频且滞后",
    fallback:   "改用 EUR-USD FX basis 作为压力代理（已在 fx_swaps 边覆盖）",
  },
};
```

#### C2. 注入 constants.js

- [x] 修改 `js/v2/constants.js`，让每个 NODE / EDGE 引用 `NODE_PROXIES` / `EDGE_PROXIES`：

```javascript
// js/v2/constants.js 顶部
import { NODE_PROXIES, EDGE_PROXIES } from "./proxy_registry.js";

// 节点构造时附加
export const NODES = NODES_RAW.map(n => ({
  ...n,
  proxy: NODE_PROXIES[n.id] || null,
}));

// 边同理
export const EDGES = EDGES_RAW.map(e => ({
  ...e,
  proxy: EDGE_PROXIES[e.transaction_type] || null,
}));
```

#### C3. Tooltip 与节点徽章读取 proxy

- [x] 修改 `js/v2/tooltip.js`：当 hover 节点/边时，从 `node.proxy` / `edge.proxy` 读取 `primary.series` 并查询 `dataLoader` 获取最新值
- [x] 修改 `js/v2/nodes.js`：节点徽章右上角显示 proxy 主指标的最新值（格式见 `dataLoader.formatValue()`） — 通过新增 `js/v2/badges.js` 叠加层实现，避免改动 v1 渲染
- [x] 对 `proxy_status: "not_found"` 的节点，徽章显示灰色 "n/a"
- [x] 对 `proxy_status: "external" / "partial"` 的节点，徽章右下角加小图标 ⓘ，hover 显示获取方式说明

#### C4. 人类可读的论证文档

- [x] 新建 `docs/proxy_mapping.md`，按节点/边各一张表，列出：
  - 节点 ID / 中文名
  - 主 proxy 系列（含 source、series_id、频率）
  - 备选 proxy
  - 理论依据（1-2 句）
  - 实证锚（建议的相关性测试）
  - proxy_status

> 此文档同时作为 PR review 的依据，不要求 Claude Code 自动生成数值，仅整理结构表格。

### 3.3 自检建议（非阻塞）

完成 C1–C4 后，可在浏览器 console 跑：

```javascript
// 快速自检：所有节点都有 proxy 条目
import('./js/v2/proxy_registry.js').then(m => {
  console.log('nodes:', Object.keys(m.NODE_PROXIES).length,
              'edges:', Object.keys(m.EDGE_PROXIES).length);
});
```

不强制阻塞——proxy 缺失不会影响图表渲染，仅徽章显示 n/a。

---

## 4. Module E — 新增三条连线（依赖 A）

### 4.1 任务清单

- [x] 修改 `js/v2/constants.js` 的 `EDGES`，新增三条：

```javascript
// js/v2/constants.js — EDGES 新增片段
{ id: "edge_srf",
  source: "broker_dealers", target: "fed_repo_assets",
  transaction_type: "srf",
  label: "SRF",
  style: { color: "#d62728", dash: "4 2", arrow: "double" } },

{ id: "edge_dw",
  source: "us_banks", target: "fed_lending",
  transaction_type: "discount_window",
  label: "Discount Window",
  style: { color: "#9467bd", dash: "6 3" } },

{ id: "edge_foreign_rrp",
  source: "fcb_swf", target: "fed_rrp_liab",
  transaction_type: "on_rrp",
  variant: "foreign",
  label: "Foreign Repo Pool",
  style: { color: "#17becf" } },
```

- [x] 在 `js/v2/sidebar.js` 的 Transaction Types 列表中追加这三类，含图例颜色

> **S4 完成说明（2026-04）**：
> - 因 Module C 尚未追加 v2 专用 Fed-side 节点（`fed_repo_assets` / `fed_lending`），实现时把 endpoint 映射到现有 v1 BS 节点：
>   - `edge_dw`: `us_banks → bs_primary_credit`（Primary Credit Facility = Discount Window）
>   - `edge_foreign_rrp`: `fcb_swf_supra_offshore → bs_foreign_repo`（v1 已有 Foreign repo pool 子项）
>   - `edge_srf`: `dealers → bs_others_assets`（临时挂靠；S3 完成后须 re-target 到 `fed_repo_assets`）
> - Sidebar UI 在 v2 尚未挂载（Module B 验收明确不显示侧边栏），故 Transaction Types 三类以 `TRANSACTION_TYPES_V2_NEW` 数据形式暴露在 `js/v2/constants.js`，由后续 sidebar 渲染消费。
> - `js/v2/edges.js` 同步扩展：
>   - `toBox()` 把 v1 中心坐标节点转成 routing 期望的 top-left + size
>   - 渲染遵循 `style.color` / `style.dash` / `label`（textPath 居中标签）
>   - 同时把 `transaction_type` 写到 `data-transaction-type`，方便后续按类型 toggle

> **自检建议（非阻塞）**：浏览器中点击 SRF / Discount Window / Foreign RRP 图例项，对应连线应高亮、其他变灰。

---

## 5. Module D — 价差通道（P1，依赖 A + C）

> 仅在 A、C 完成后启动。本节给出最小可用版本；详细 dashboard 推迟至 Module F。

### 5.1 任务

- [ ] 修改 `js/v2/edges.js`：每条边渲染时，根据 `edge.proxy.price_proxy` 计算"压力分位数"并染色：

```javascript
// js/v2/edges.js — 新增片段
function pressureColor(value, history) {
  if (value == null || !history?.length) return "#bbb";
  const sorted = [...history].sort((a, b) => a - b);
  const rank = sorted.findIndex(v => v >= value) / sorted.length;
  if (rank > 0.99) return "#d62728";  // 红：>99 分位
  if (rank > 0.90) return "#ff7f0e";  // 橙：>90 分位
  if (rank > 0.75) return "#ffbb33";  // 黄
  return "#2ca02c";                   // 绿
}

// 每条 path 同时绘制两层：
// 1. 实线（量）：宽度 = log(volume) 映射，颜色按 transaction_type
// 2. 虚线平行线（价压力）：颜色 = pressureColor()，offset 4px
```

- [ ] 在 `data/export_json.py` 的 `pressure_indicators.json` 中预先计算每个 spread 的 5 年滚动分位数，避免前端重复计算

> **自检建议（非阻塞）**：边在 2019-9-17 / 2020-3-12 / 2023-3-13 三个历史压力日应切到红色；非压力日为绿色。

---

## 6. Module F — 压力探针 dashboard（P2，独立里程碑）

> 推迟到 A-E 全部稳定后再启动。本里程碑产出 7 个堵点指示器面板，作为侧边栏顶部的固定 widget。

预留接口：

```javascript
// js/v2/sidebar.js 预留 hook
export const PRESSURE_PROBES = [
  "sofr_iorb_spread_bps",
  "effr_iorb_spread_bps",
  "eur_usd_3m_basis",
  "rrp_counterparties_count",
  "srf_takeup_usd_b",
  "dealer_ust_coupon_pct_slr",
  "tbill_rrp_spread_bps",
];
```

实现细节在 D 完成后再展开，本文档不涉及。

---

## 7. 跨模块集成与验收

### 7.1 集成顺序

```
Day 1 → 启动 A 和 B（并行）
Day 2 → A 完成 → 启动 C 和 E（并行）
Day 3 → B、C、E 完成
Day 4 → 启动 D
```

### 7.2 强制验收节点（仅两处）

**节点①：Module A 完成时（数据底座）**

```bash
python3 -c "
import json, pathlib
files = ['fed_balance_sheet.json','treasury_flows.json',
        'nyfed_operations.json','pressure_indicators.json',
        'available_dates.json','time_series.json']
for f in files:
    p = pathlib.Path('data/json')/f
    assert p.exists(), f'缺失 {f}'
    print(f'[OK] {f} {p.stat().st_size//1024}KB')
"
```
通过条件：6 个 JSON 全部存在，`pressure_indicators.json` 中 `sofr_iorb_spread_bps` ≥ 1500 行。

**节点②：Module B 完成时（布局重构）**

`python3 -m http.server 8000` 后浏览器视觉核对：
1. 双面板（FED + Market）+ 嵌套层级正确显示
2. 5 个虚线分组正确包裹相应节点
3. **没有边穿过节点矩形**

其余模块（C / D / E）**不阻塞流程**——proxy 缺失、价差未着色、新边未点亮均不影响主图可用性，可在 release 前一次性走查。

### 7.3 软目标（release 前一次性核对）

- Proxy：所有节点 hover 显示数值或 n/a
- 新边：SRF / DW / Foreign RRP 在图例和画布中均出现
- 价压（D 完成后）：边在历史压力日变红
- 性能：首次加载 < 3s，时间切换 < 200ms
- 无 console error / warning

### 7.4 Git 提交规范

每个模块独立 PR：

```
feat(data): expand FRED+Treasury+NYFed pipeline   # Module A
feat(layout): dual-panel + dashed groups          # Module B
feat(proxy): node/edge proxy registry             # Module C
feat(edges): add SRF / DW / Foreign RRP           # Module E
feat(viz): price-spread pressure channel          # Module D
```

---

## 附录 A — 关键依赖

```
# requirements.txt 追加
requests>=2.31
python-dateutil>=2.8
```

## 附录 B — 已知风险与回退方案

| 风险 | 影响 | 回退 |
|---|---|---|
| NY Fed API 端点结构变更 | A3 拉取失败 | 用 FRED 替代（牺牲日内分位数） |
| OFR Cleared Repo 数据延迟 | sponsored repo 边显示空 | proxy_status=partial，徽章灰显 |
| FX basis 无免费数据源 | fx_swaps 边压力探针缺价 | 仅显示量，价格通道留空带 ⓘ 提示 |
| 新布局某些边仍交叉 | 视觉降级 | 手工调整节点 ±20px 坐标 |

## 附录 C — 参考文档

- 原图：[NY Fed Mapping U.S. Dollar Funding Flows (2019)](https://www.newyorkfed.org/research/blog/2019_LSE_Markets_Interactive_afonso)
- Treasury Fiscal Data API: https://fiscaldata.treasury.gov/api-documentation/
- NY Fed Markets API: https://markets.newyorkfed.org/static/docs/markets-api.html
- OFR Short-term Funding Monitor: https://www.financialresearch.gov/short-term-funding-monitor/