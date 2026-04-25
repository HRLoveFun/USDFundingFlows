# Mapping U.S. Dollar Funding Flows

一个基于 D3.js 的交互式可视化项目，复现并扩展了纽约联储（NY Fed）2019 年发布的 **"Mapping U.S. Dollar Funding Flows"** 图表。项目展示了美元货币市场中各类金融机构之间的借贷关系与资金流动，并集成了真实的时间序列数据，支持按季度回溯历史资金状况。

---

## 功能特性

- **机构网络全景图**：28 个实体节点（美联储资产负债表项目、在岸/离岸银行、货币基金、对冲基金等），按功能分区布局
- **10 种交易类型**：Commercial Paper、Eurodollar、Fed Funds、Repo、FX Swaps、ON RRP 等，以不同颜色/线型区分
- **时间维度切换**：通过下拉菜单或滑块切换季度（2013 年至今），动态更新各条资金流动关系的数值标注
- **数据驱动的标注**：边上实时显示利率（如 SOFR、EFFR）、余额（如 Reserve Balances、ON RRP）或交易量
- **交互式高亮**：点击侧边栏的 Transaction Type，隔离显示关联的资金流动路径
- **悬停提示**：鼠标悬停节点或连线，显示详细定义、当前数值及数据来源
- **术语表（Glossary）**：侧边栏内置可搜索的金融术语词典

---

## 项目结构

```
USDFundingFlows/
├── index.html                  # 主页面入口
├── css/
│   ├── main.css                # 全局布局与响应式样式
│   ├── diagram.css             # SVG 图表、节点、连线的视觉样式
│   └── sidebar.css             # 侧边栏面板、按钮、图例样式
├── js/
│   ├── app.js                  # 应用入口：初始化数据加载、图表、控件
│   ├── config.js               # 集中式视觉/布局/交互配置常量
│   ├── constants.js            # 节点定义、连线定义、交易类型、术语表数据
│   ├── nodes.js                # D3 节点渲染（形状、标签、数据徽章）
│   ├── edges.js                # D3 连线渲染（贝塞尔曲线、箭头、标签、高亮）
│   ├── diagram.js              # 图表协调器：SVG 创建、分层渲染、更新逻辑
│   ├── data-loader.js          # 异步加载 JSON 数据，提供日期查询与数值格式化
│   ├── time-selector.js        # 日期下拉选择与滑块控件
│   ├── tooltip.js              # 鼠标悬停提示框（节点/连线详情）
│   └── sidebar.js              # 侧边栏：Transaction Types / Legend / Glossary
├── data/
│   ├── series_config.py        # FRED 系列 ID 与图表元素的权威映射配置
│   ├── fetch_fred_data.py      # 从 FRED API 下载原始时间序列数据
│   ├── build_database.py       # 构建/填充 SQLite 数据库
│   ├── export_json.py          # 导出前端所需的 JSON 数据文件
│   ├── funding_flows.db        # SQLite 数据库（本地生成，未提交到 Git）
│   └── json/                   # 导出的静态数据（已提交到仓库）
│       ├── available_dates.json
│       ├── raw_observations.json
│       ├── series_metadata.json
│       └── time_series.json
├── requirements.txt            # Python 依赖
├── implementation_plan.md      # 项目实施计划与数据源映射文档
└── edge_routing_interface_design.md  # 连线路由模块化重构设计文档
```

---

## 技术栈

### 前端
- **D3.js v7** — SVG 可视化与数据驱动渲染
- **原生 ES6 Modules** — 模块化 JavaScript，无构建工具依赖
- **HTML5 / CSS3** — 响应式布局、CSS Grid/Flexbox

### 数据层
- **Python 3** + **fredapi** — 从 FRED（美联储经济数据）API 获取时间序列
- **SQLite** — 本地结构化存储观测值与元数据
- **pandas** — 数据清洗与 as-of 日期对齐（处理混合频率数据）

---

## 快速开始

### 1. 克隆仓库并进入目录

```bash
git clone <repo-url>
cd USDFundingFlows
```

### 2. 启动前端（零构建）

由于项目使用原生 ES6 Modules，直接用任意静态服务器即可：

```bash
python3 -m http.server 8000
```

然后在浏览器中打开 `http://localhost:8000`。

### 3. 更新数据（可选）

如需从 FRED 重新拉取最新数据：

```bash
cd data
pip install -r ../requirements.txt

# 配置 FRED API Key（需要免费注册 https://fred.stlouisfed.org/docs/api/api_key.html）
cp .env.example .env
# 编辑 .env，填入 FRED_API_KEY=your_key_here

python3 fetch_fred_data.py      # 下载原始数据
python3 build_database.py       # 构建 SQLite 数据库
python3 export_json.py          # 导出前端 JSON
```

> 注：仓库中已包含预生成的 `data/json/` 文件，无需运行 Python 即可直接查看可视化。

---

## 核心架构

### 数据流

```
FRED API  →  fetch_fred_data.py  →  raw_observations.json
                                              ↓
                                    build_database.py  →  funding_flows.db
                                              ↓
                                    export_json.py  →  data/json/*.json
                                              ↓
                                    DataLoader (js)  →  D3 渲染
```

`export_json.py` 使用 **as-of 对齐逻辑**：对每个季度末日期，取各系列截至该日期的最新观测值，从而统一日、周、月、季度混合频率数据。

### 前端模块关系

```
app.js (入口)
  ├── DataLoader  ←── data/json/*.json
  ├── Diagram     ←── nodes.js + edges.js + constants.js
  ├── TimeSelector
  ├── Sidebar
  └── Tooltip
```

### 图表布局与拓扑结构

**画布尺寸**：2150 × 1280（SVG viewBox，响应式缩放）。整个图表由左右两大面板构成，内部再按层级嵌套多个背景区域（Section），最终放置 28 个实体节点（Node）与约 49 条有向资金流动边（Edge）。

#### 面板层级（Section Tree）

```
├─ 左侧面板：FEDERAL RESERVE (520×1220, level=1)
│  └─ BALANCE SHEET (470×1175, level=2)
│     ├─ Assets 列（左列标注）
│     └─ Liabilities 列（右列标注）
│
└─ 右侧面板：U.S. DOLLAR FUNDING MARKET (1420×1220, level=1)
   ├─ ONSHORE ENTITIES (940×1175, level=2)
   │  ├─ Banks and Dealers (905×300, level=3)
   │  │  └─ [虚线框 dash_banks_pair: 包裹 U.S. Banks + U.S. Branches]
   │  ├─ Onshore Investors (905×520, level=3)
   │  │  ├─ [虚线框 dash_mmf_row: 包裹 Gov MMF + Prime MMF]
   │  │  └─ [虚线框 dash_investor_group: 包裹 Securities Lenders + Corporates + FCBs/SWFs + Hedge Funds]
   │  └─ U.S. Government Entities (905×230, level=3)
   │     └─ [虚线框 dash_gse_pair: 包裹 FHLB + GSEs]
   │
   └─ OFFSHORE ENTITIES (260×1175, level=2)
      └─ [虚线框 offshore_investors: 包裹 Foreign Insurers + Foreign Banks + Corporates]
```

#### 28 个实体节点（按所属区域排列）

| 区域 | 节点 ID | 显示标签 | 形状 |
|---|---|---|---|
| **Balance Sheet — Assets** | `bs_treasuries` | U.S. Treasury Securities | bs_parent |
| | `bs_agency_mbs` | Agency Debt and MBS Securities | bs_parent |
| | `bs_primary_credit` | Primary Credit Facility | bs_parent |
| | `bs_cb_swaps` | Central Bank U.S. Dollar Liquidity Swaps | bs_parent |
| | `bs_foreign_reserves` | Foreign Reserves | bs_parent |
| | `bs_others_assets` | Others | bs_parent |
| **Balance Sheet — Liabilities** | `bs_reserve_balances` | Reserve Balances (from depository institutions) | bs_parent |
| | `bs_fed_notes` | Federal Reserve Notes (currency in circulation) | bs_parent |
| | `bs_rrp` | Reverse Repurchase Agreements | bs_parent |
| | └ `bs_rrp_omo` | Open market operations | bs_child |
| | └ `bs_foreign_repo` | Foreign repo pool | bs_child |
| | `bs_other_liab` | Other Liabilities | bs_parent |
| | └ `bs_tga` | U.S. Treasury General Account (TGA) | bs_child |
| | └ `bs_fhlb_deposits` | FHLB, DFMU, and other deposits | bs_child |
| **Banks and Dealers** | `us_banks` | U.S. Banks | 六边形 |
| | `us_fbo` | U.S. Branches of Foreign Banks | 六边形 |
| | `dealers` | Dealers | 六边形 |
| **Onshore Investors** | `retail_investors` | Retail Investors | 圆形 |
| | `gov_mmf` | Government Money Market Funds | 圆形 |
| | `prime_mmf` | Prime Money Market Funds | 圆形 |
| | `securities_lenders` | Securities Lenders | 圆形 |
| | `corporates_onshore` | Corporates | 圆形 |
| | `fcb_swf_supra_onshore` | FCBs, SWFs, Supras | 圆形 |
| | `hedge_funds` | Hedge Funds & Other Managers | 圆形 |
| **U.S. Government Entities** | `fhlb` | Federal Home Loan Banks | 六边形 |
| | `gse` | Fannie, Freddie, and other GSEs | 六边形 |
| | `us_treasury` | U.S. Treasury | 矩形 |
| **Offshore Entities** | `fcb_swf_supra_offshore` | Foreign Central Banks, SWFs, and Supranational Organizations | 圆形 |
| | `foreign_insurers` | Foreign Insurers & Other Money Managers | 圆形 |
| | `foreign_banks` | Foreign Banks & Foreign Branches of U.S. Banks | 六边形 |
| | `corporates_offshore` | Corporates | 圆形 |
| | `offshore_mmf` | Offshore Money Market Funds | 圆形 |

> **形状语义**：六边形 = 银行/中介类机构；圆形 = 投资者/基金类机构；矩形 = 政府机构；bs_parent/bs_child = 美联储资产负债表项目（父子层级结构）。

#### 边（Edge）连接拓扑

约 **49 条有向边**，按 10 种 Transaction Type 着色，连接模式分为三类：

1. **节点 → 节点**：如 `us_banks ↔ dealers`（Repo，双向）、`fhlb → us_banks`（FHLB Advances）。
2. **区域 → 节点 / 区域 → 区域**：如 `sec:banks_dealers → bs_reserve_balances`（ Reserve Balances 流入美联储负债端）、`sec:onshore_inv → sec:dash_banks_pair`（存款流入银行体系）。
3. **自环（Self-loop）**：如 `us_banks → us_banks`、`us_fbo → us_fbo`，表示联邦基金市场内部拆借。

每条边携带 `seriesIds` 字段，关联到 FRED 时间序列，用于在时间切换时动态渲染利率或余额数值。

---

## 数据源

| 来源 | 说明 | 认证 |
|---|---|---|
| [FRED](https://fred.stlouisfed.org/) | 美联储经济数据（系列 ID 映射见 `series_config.py`） | 需免费 API Key |
| [OFR STFM](https://data.financialresearch.gov/) | 金融研究办公室短期融资监测（Repo、MMF 等） | 无需认证 |
| [NY Fed Markets](https://markets.newyorkfed.org/) | 纽约联储市场数据（EFFR、SOFR、SOMA 持仓等） | 无需认证 |

项目共覆盖约 **43 个 FRED 时间序列**，映射到 10 种 Transaction Type 和 28 个实体节点。

---

## 参考

- 原图表来源：[NY Fed — Mapping U.S. Dollar Funding Flows](https://www.newyorkfed.org/research/blog/2019_LSE_Markets_Interactive_afonso)（Gara Afonso, Fabiola Ravazzolo, Alessandro Zori, 2019）

---

## License

MIT
