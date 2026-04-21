# Mapping U.S. Dollar Funding Flows — Time Series Visualization

## Context

NY Fed 于 2019 年发布了交互式图表 "Mapping U.S. Dollar Funding Flows"（作者：Gara Afonso, Fabiola Ravazzolo, Alessandro Zori），展示美元货币市场中各机构之间的借贷关系和资金流动。本项目旨在：
1. 用 HTML/SVG/D3.js 复现该图表的全部结构信息（实体、流动关系、Transaction Types、Legend、Glossary）
2. 通过 FRED API 获取相关时间序列数据，建立 SQLite 数据库
3. 在 HTML 图表上增加时间维度（下拉列表切换日期），使每条流动关系附带定量数值（利率、余额、交易量等）

**数据来源**：用户提供的 `dollarflow.md`（从 NY Fed 原网页导出）+ FRED API + OFR STFM API + NY Fed Markets API。

---

## 项目结构

```
/home/user/USDFundingFlows/
├── index.html                  # 主页面（根目录便于 python3 -m http.server）
├── css/
│   ├── main.css                # 全局布局样式
│   ├── diagram.css             # SVG 图表样式
│   └── sidebar.css             # 侧边栏样式
├── js/
│   ├── constants.js            # 节点/边/颜色/术语表定义（核心配置）
│   ├── nodes.js                # D3 节点渲染
│   ├── edges.js                # D3 边/流渲染（贝塞尔曲线+箭头）
│   ├── diagram.js              # 图表协调器
│   ├── data-loader.js          # 加载 JSON 数据
│   ├── time-selector.js        # 日期下拉/滑块逻辑
│   ├── tooltip.js              # 悬停提示
│   ├── sidebar.js              # Transaction Types / Legend / Glossary 面板
│   └── app.js                  # 入口，初始化
├── data/
│   ├── series_config.py        # FRED 系列 ID 与图表元素映射
│   ├── fetch_fred_data.py      # 从 FRED 下载数据
│   ├── build_database.py       # 创建/填充 SQLite 数据库
│   ├── export_json.py          # 导出 JSON 供前端使用
│   ├── funding_flows.db        # SQLite 数据库（gitignore）
│   └── json/                   # 导出的 JSON 文件（提交到 repo）
│       ├── time_series.json
│       ├── series_metadata.json
│       └── available_dates.json
├── requirements.txt            # fredapi, pandas
├── .gitignore
├── .env.example                # FRED_API_KEY=your_key_here
└── dollarflow.md               # 原始参考资料（已在 repo）
```

---

## 图表内容定义（基于 dollarflow.md 原文）

### Transaction Types（10 种，来自原图）

| # | 交易类型 | 说明 | 涉及的机构 |
|---|---|---|---|
| 1 | Commercial paper | 商业票据 | Banks/Corporates → Prime MMFs |
| 2 | Eurodollar lending | 欧洲美元借贷 | FBOs ↔ Foreign banks/FCBs |
| 3 | Federal Home Loan Bank advances | FHLB 预付款 | FHLBs → Member DIs |
| 4 | Fed funds lending | 联邦基金借贷 | GSEs/FHLBs → DIs/FBOs |
| 5 | Fed reserve account deposits | 美联储准备金账户存款 | DIs/FBOs → Fed (Reserve Balances) |
| 6 | Foreign exchange swaps | 外汇互换（美元换外币） | U.S. entities ↔ Foreign entities/FCBs |
| 7 | Reverse repurchase agreement facility usage | ON RRP 便利使用 | Fed → MMFs, GSEs, Primary Dealers |
| 8 | Securities purchases from Treasury and GSEs | 从财政部和 GSE 购买证券 | Investors → Treasury/GSEs (T-bills, Agency, MBS) |
| 9 | U.S. dollar deposits | 美元存款（含 CD、隔夜和定期存款） | Depositors → Banks |
| 10 | U.S. dollar repo investments | 美元回购投资 | MMFs/Cash lenders → Dealers/Borrowers |

### 实体节点

基于 dollarflow.md 的 Glossary 和 Transaction Types，图中实体分三类：

**Investor Institutions（资金供给方）：**

| ID | 标签 | 说明 |
|---|---|---|
| `gov_mmf` | Government Money Market Funds | 政府型货币市场基金 |
| `prime_mmf` | Prime Money Market Funds | 优质型货币市场基金 |
| `fcb_supra_swf` | FCBs / Supras / SWFs | 外国央行、超国家组织、主权财富基金 |

**Intermediary Institutions（中间机构，既借又贷）：**

| ID | 标签 | 说明 |
|---|---|---|
| `us_banks` | U.S. Banks (Domestic DIs) | 美国存款机构 |
| `fbo` | Foreign Banking Orgs (FBOs) | 在美外资银行 |
| `fhlb` | Federal Home Loan Banks | 联邦住房贷款银行 |
| `broker_dealer` | Broker-Dealers / Primary Dealers | 交易商/一级交易商 |

**Borrower / Government Institutions：**

| ID | 标签 | 说明 |
|---|---|---|
| `us_treasury` | U.S. Treasury | 美国财政部 |
| `gse` | GSEs (Fannie / Freddie) | 政府支持企业（房利美/房地美） |
| `corporates` | Non-financial Corporates | 非金融企业 |
| `hedge_fund` | Hedge Funds / Leveraged NBFIs | 对冲基金/杠杆非银 |
| `dfmu` | DFMUs | 指定金融市场基础设施（如 CME, CLS） |

**Central（美联储资产负债表）：**

| ID | 标签 | 说明 |
|---|---|---|
| `federal_reserve` | Federal Reserve | 美联储（图表中心） |

共 **13 个实体节点**。

### 流动关系/边（按 Transaction Type 分组）

**1. Commercial paper：**
- `us_banks` → `prime_mmf`（银行发行 CP）
- `corporates` → `prime_mmf`（企业发行 CP）

**2. Eurodollar lending：**
- `fbo` → `fcb_supra_swf`（欧洲美元存款流动）
- `us_banks` → `fbo`（美元跨境借贷）

**3. Federal Home Loan Bank advances：**
- `fhlb` → `us_banks`（FHLB 向成员银行提供预付款）

**4. Fed funds lending：**
- `fhlb` → `us_banks`（FHLB 向银行拆借联邦基金）
- `fhlb` → `fbo`（FHLB 向外资银行拆借）
- `gse` → `us_banks`（GSE 向银行拆借）

**5. Fed reserve account deposits：**
- `us_banks` → `federal_reserve`（Reserve Balances，Fed 支付 IORB）
- `fbo` → `federal_reserve`（FBO 在 Fed 的准备金）

**6. Foreign exchange swaps：**
- `us_banks` ↔ `fcb_supra_swf`（美元换外币）
- `federal_reserve` ↔ `fcb_supra_swf`（央行流动性互换）

**7. Reverse repurchase agreement facility usage (ON RRP)：**
- `federal_reserve` → `gov_mmf`
- `federal_reserve` → `gse`
- `federal_reserve` → `broker_dealer`

**8. Securities purchases from Treasury and GSEs：**
- `us_treasury` → `gov_mmf`（T-bills）
- `gse` → `gov_mmf`（Agency debt/MBS）
- `us_treasury` → `us_banks`（Treasury securities）
- `gse` → `us_banks`（Agency MBS）

**9. U.S. dollar deposits (including CDs)：**
- `prime_mmf` → `us_banks`（MMF 投资银行 CD/存款）
- `corporates` → `us_banks`（企业存款）
- `fcb_supra_swf` → `us_banks`（外国机构美元存款）

**10. U.S. dollar repo investments：**
- `gov_mmf` → `broker_dealer`（三方回购）
- `prime_mmf` → `broker_dealer`（回购）
- `broker_dealer` → `hedge_fund`（双边回购）
- `us_banks` → `broker_dealer`（银行提供回购融资）
- `fcb_supra_swf` → `federal_reserve`（Foreign repo pool）

### Glossary（来自 dollarflow.md 原文）

| 术语 | 定义 |
|---|---|
| Agency MBS | Mortgage-backed securities issued by GSEs such as Fannie Mae or Freddie Mac |
| DFMU | Designated financial market utility, such as the Clearing House Payments Company or the Chicago Mercantile Exchange |
| Eurodollars | U.S. dollar-denominated deposits at foreign banks or branches of U.S. banks outside of the United States |
| Fannie | The Federal National Mortgage Association, commonly known as Fannie Mae |
| FCB | Foreign central bank |
| Foreign repo pool | Overnight U.S. dollar investment service that the Federal Reserve offers to foreign official and international accounts |
| Freddie | The Federal Home Loan Mortgage Corporation, commonly known as Freddie Mac |
| GSEs | Government-sponsored enterprises, such as Fannie Mae, Freddie Mac, and the Federal Home Loan Banks |
| Intermediary institutions | Institutions that both borrow and invest in short-term U.S. dollar funding markets |
| Investor institutions | Institutions that invest in dollar funding instruments |
| MBS | Mortgage-backed securities guaranteed by Fannie Mae, Freddie Mac, or Ginnie Mae |
| Supra | Supranational organization, such as the International Monetary Fund or the United Nations |
| SWF | Sovereign wealth fund |

### Legend（图例）

基于原图 LegendEdited.png，Legend 包含：
- **节点颜色**：三类机构用不同底色区分（Investor=青色, Intermediary=蓝色, Borrower=橙色, Fed=深蓝）
- **边线样式**：10 种 Transaction Type 各有独特颜色/线型标识
- **箭头方向**：表示资金/美元流向（从出借方指向借入方，或从发行方指向投资方）

---

## FRED 数据源映射

### 数据 API 概览（三个免费源）

| API | Base URL | 认证 | 格式 |
|---|---|---|---|
| **FRED** (fredapi) | `api.stlouisfed.org/fred/` | 需 API Key（免费） | JSON |
| **OFR STFM** | `data.financialresearch.gov/v1/` | **无需认证** | JSON |
| **NY Fed Markets** | `markets.newyorkfed.org/api/` | **无需认证** | JSON/CSV |

### 按 Transaction Type 逐项核查

#### #1 Commercial Paper ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| COMPOUT | CP Outstanding (total) | W | ✅ |
| FINCP | Financial CP Outstanding | W | ✅ 新增 |
| COMPAPER | Nonfinancial CP Outstanding | W | ✅ 新增 |
| BOGZ1FL633030000Q | MMF Time/Savings Deposits (含CD) | Q | ✅ |

#### #2 Eurodollar Lending ⚠️ 仅利率+量，无独立存量
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| OBFRVOL | Overnight Bank Funding Volume（含Eurodollar交易） | D | ✅ |
| IR3TED01USM156N | 3-Month Eurodollar Deposit Rate | M | ✅ 新增 |
| — | Eurodollar 存量/余额 | — | ❌ 无免费API |

> 补充：OBFRVOL 包含 Eurodollar 交易，可作为代理指标。

#### #3 FHLB Advances ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| BOGZ1FL403069330Q | FHLB Advances Outstanding | Q | ✅ |

#### #4 Fed Funds Lending ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| EFFR | Effective Fed Funds Rate | D | ✅ |
| DFF | Daily Fed Funds Rate | D | ✅ |
| EFFRVOL | Fed Funds Volume | D | ✅ |
| OBFRVOL | Overnight Bank Funding Volume | D | ✅ |

> 补充：OFR STFM `FNYR-EFFR-D` + NY Fed API `rates/effr` 含百分位分布。

#### #5 Fed Reserve Account Deposits ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| WRESBAL | Reserve Balances | W | ✅ |
| IORB | Interest on Reserve Balances Rate | D | ✅ 新增 |
| WDTGAL | Treasury General Account | W | ✅ |
| WDFOA | Foreign Official Deposits at Fed | W | ✅ 新增 |
| WLCFLPCL | Primary Credit Loans (Discount Window) | W | ✅ 新增 |

#### #6 Foreign Exchange Swaps ✅ 充足（Fed 端）
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| SWPT | CB Liquidity Swaps (Wed level) | W | ✅ 新增 |
| WCBLSA | CB Liquidity Swaps (Week Avg) | W | ✅ 新增 |
| WSEFINTL1 | Fed Custody Holdings for Foreign Accounts | W | ✅ 新增 |
| WMTSECL1 | Fed Custody Marketable Treasuries | W | ✅ 新增 |
| FDHBFIN | Fed Debt Held by Foreign/Intl Investors | Q | ✅ 新增 |

> 私人部门 FX Swap 交易量无免费 API，SWPT 覆盖 Fed 端已足够。

#### #7 Reverse Repo Facility (ON RRP) ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| RRPONTTLD | ON RRP Total | D | ✅ |
| WLRRAL | Fed Reverse Repos (Wed level) | W | ✅ |
| BOGZ1FL632051103Q | MMF Repos with Fed (ON RRP) | Q | ✅ |

> 补充：NY Fed API `rp/reverserepo/` 提供每日操作细节。

#### #8 Securities Purchases ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| TREAST | Fed Holdings: Treasury Securities | W | ✅ |
| BOGZ1FL633061110Q | MMF Treasury Bills | Q | ✅ |
| BOGZ1FL633061105Q | MMF Treasury Securities | Q | ✅ |
| GFDEBTN | Federal Debt: Total Public Debt | Q | ✅ 新增 |
| BOGZ1FL403065015Q | Fannie Mae Mortgages Held | Q | ✅ 新增 |
| BOGZ1FL403065025Q | Freddie Mac Mortgages Held | Q | ✅ 新增 |
| BOGZ1FL404090423Q | Freddie Mac Total Assets | Q | ✅ 新增 |

> 补充：NY Fed API `soma/summary.json` 提供 SOMA 持仓（国债+Agency+MBS）。

#### #9 U.S. Dollar Deposits (CDs) ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| BOGZ1FL633030000Q | MMF Time/Savings Deposits | Q | ✅ |
| DPSFRIM027SBOG | Deposits at Foreign-Related Institutions | M | ✅ 新增 |
| FBOUSIBFDFBA | FBO Deposits at Foreign Banks | Q | ✅ 新增 |
| OBFRVOL | Overnight Bank Funding Volume（含存款交易） | D | ✅ |

#### #10 U.S. Dollar Repo Investments ✅ 充足
| FRED ID | 名称 | 频率 | 状态 |
|---|---|---|---|
| SOFR | Secured Overnight Financing Rate | D | ✅ |
| SOFRVOL | SOFR Volume | D | ✅ 新增 |
| RPONTSYD | Fed Repo Operations: Treasury Securities | D | ✅ |
| BOGZ1FL632051000Q | MMF Total Repo Assets | Q | ✅ 新增 |
| BOGZ1FL662151003Q | Broker-Dealer Repo Liabilities | Q | ✅ 新增 |
| BOGZ1FL622051003Q | Hedge Fund Repo Assets | Q | ✅ 新增 |
| BOGZ1FL664090663Q | Broker-Dealer Total Assets | Q | ✅ 新增 |
| DPCREDIT | Discount Window Primary Credit Rate | D | ✅ 新增 |

> 补充：OFR STFM `REPO-*` 系列提供按期限/抵押品分类的每日 repo 利率和交易量。

### 实体节点数据映射

| 节点 | 存量/规模指标 | 状态 |
|---|---|---|
| `federal_reserve` | WALCL (Total Assets) | ✅ |
| `us_treasury` | WDTGAL (TGA) + GFDEBTN (Total Debt) | ✅ |
| `gse` | BOGZ1FL404090423Q (Freddie Assets) + BOGZ1FL403065015Q (Fannie) | ✅ |
| `fhlb` | BOGZ1FL403069330Q (Advances) | ✅ |
| `us_banks` | H.8 Release 系列 | ✅ |
| `fbo` | DPSFRIM027SBOG (Deposits) + FBOUSIBFDFBA | ✅ |
| `gov_mmf` | BOGZ1FL634090033Q (Gov MMF Total Assets) | ✅ 新增 |
| `prime_mmf` | MMMFFAQ027S − BOGZ1FL634090033Q (计算差值) | ✅ 计算 |
| `broker_dealer` | BOGZ1FL664090663Q (B/D Total Assets) | ✅ 新增 |
| `hedge_fund` | BOGZ1FL622051003Q (HF Repo Assets) | ✅ 新增 |
| `corporates` | COMPAPER (Nonfinancial CP Outstanding) | ✅ 部分 |
| `dfmu` | 无公开免费数据 | ❌ |
| `fcb_supra_swf` | WSEFINTL1 (Custody) + SWPT (Swaps) + FDHBFIN | ✅ 新增 |

### 补充 API 端点详情

#### OFR STFM API（无需 API Key）
```
Base: https://data.financialresearch.gov/v1/
端点：
  GET /metadata/mnemonics                              → 全部系列列表
  GET /series/timeseries?mnemonic=REPO-DVP_AR_G30-P    → 单系列
  GET /series/multifull?mnemonics=X,Y,Z                → 多系列+元信息

关键系列：REPO-* (repo利率/量)、FNYR-* (参考利率)、MMF-* (基金持仓)
```

#### NY Fed Markets API（无需 API Key）
```
Base: https://markets.newyorkfed.org/api/
端点：
  GET /rates/effr/last/30.json    → EFFR 近30天（含量/百分位）
  GET /rates/sofr/last/30.json    → SOFR 近30天
  GET /rates/obfr/last/30.json    → OBFR 近30天
  GET /rp/all/all/results/last.json → Repo 操作
  GET /soma/summary.json          → SOMA 持仓
格式：支持 .json/.csv/.xml 后缀
```

### 数据覆盖汇总

| Transaction Type | 覆盖 | FRED 系列数 | 补充源 |
|---|---|---|---|
| #1 Commercial paper | ✅ 充足 | 4 | — |
| #2 Eurodollar lending | ⚠️ 部分 | 2 | OFR(OBFR) |
| #3 FHLB advances | ✅ 充足 | 1 | — |
| #4 Fed funds lending | ✅ 充足 | 4 | OFR+NYFed |
| #5 Fed reserve deposits | ✅ 充足 | 5 | — |
| #6 FX swaps | ✅ 充足 | 5 | — |
| #7 ON RRP facility | ✅ 充足 | 3 | NYFed |
| #8 Securities purchases | ✅ 充足 | 7 | NYFed(SOMA) |
| #9 USD deposits | ✅ 充足 | 4 | OFR(MMF) |
| #10 USD repo investments | ✅ 充足 | 8 | OFR(REPO)+NYFed |

**总计：~43 个 FRED 系列 + OFR API + NY Fed API。10 个 Transaction Type 中 9 个数据充足，1 个（Eurodollar）部分覆盖。**

---

## 实施步骤

### Phase 1: 项目脚手架
1. 创建 `.gitignore`（忽略 `.env`, `*.db`, `__pycache__/`）
2. 创建 `.env.example`（`FRED_API_KEY=your_key_here`）
3. 创建 `requirements.txt`（`fredapi>=0.5.2`, `pandas>=2.0`）
4. 创建所有目录：`css/`, `js/`, `data/`, `data/json/`

### Phase 2: 数据层（Python）

**Step 2.1: `data/series_config.py`**
- 定义 `FRED_SERIES` 字典：每个 series_id 映射到 name, units, frequency, transaction_type, node_id 等
- 定义 `TRANSACTION_TYPES` 列表（10 种）
- 此文件是 FRED 数据与图表元素之间的权威映射

**Step 2.2: `data/fetch_fred_data.py`**
- 加载 `.env` 中的 `FRED_API_KEY`
- 使用 `fredapi.Fred` 逐个下载 `FRED_SERIES` 中的系列（起始 2013-01-01）
- 0.6 秒间隔防 FRED 限流（120 请求/分钟）
- 指数退避重试（最多 3 次）

**Step 2.3: `data/build_database.py`**
- SQLite 表结构：
```sql
CREATE TABLE series_metadata (
    series_id TEXT PRIMARY KEY,
    name TEXT, units TEXT, frequency TEXT,
    transaction_type TEXT, node_id TEXT, last_updated TEXT
);
CREATE TABLE observations (
    series_id TEXT, date TEXT, value REAL,
    PRIMARY KEY (series_id, date)
);
```
- `INSERT OR REPLACE` 幂等写入

**Step 2.4: `data/export_json.py`**
- 生成季度端点日期列表（3/31, 6/30, 9/30, 12/31）
- 对每个季末日期，取各系列截至该日最新观测值（"as-of"逻辑对齐混合频率）
- 导出三个 JSON：`time_series.json`（按日期索引的全部数值）、`series_metadata.json`、`available_dates.json`

### Phase 3: 前端可视化（HTML/CSS/D3.js）

**Step 3.1: `js/constants.js`** — 核心配置文件
- `NODES` 数组：13 个节点的 id, label, x, y, category (investor/intermediary/borrower/central)
- 布局：手动定位，1400x900 坐标空间
  - Federal Reserve 在中心
  - Investor institutions（MMFs, FCBs）在左侧
  - Intermediary institutions（Banks, FBOs, FHLBs, Dealers）在中间
  - Borrower institutions（Treasury, GSEs, Corporates, Hedge Funds, DFMUs）在右侧
- `EDGES` 数组：每条边含 id, source, target, transactionType, seriesIds[], label
- `TRANSACTION_TYPES` 数组：10 种类型的 id, name, color, dashPattern
- `GLOSSARY` 数组：13 个术语（来自 dollarflow.md 原文）
- `COLORS` 对象：节点类别颜色、边类型颜色

**Step 3.2: `js/nodes.js`**
- D3 渲染节点：圆角 `<rect>` + 多行 `<tspan>` 标签 + 可选数据徽章
- 节点底色按 category 区分
- 悬停时高亮关联边、暗化无关节点

**Step 3.3: `js/edges.js`** — 最复杂模块
- 二次贝塞尔曲线路径（`M x1,y1 Q cx,cy x2,y2`）
- 同节点对多条边时垂直偏移（perpendicular offset）避免重叠
- SVG `<marker>` 定向箭头
- 边标签（交易类型名 + 数值标注如 "$93.2B" 或 "5.33%"）
- 不同 Transaction Type 用不同颜色和 dash pattern

**Step 3.4: `js/diagram.js`** — 图表协调器
- 创建 SVG（viewBox 响应式）
- 分层渲染：`<defs>` (markers) → edges layer → nodes layer → labels layer
- `updateValues(date, dataLoader)` — 更新所有边和节点的数值标注
- `highlightTransactionType(typeId)` — 高亮指定交易类型的边，暗化其余
- `resetHighlight()` — 恢复全部显示

**Step 3.5: `js/data-loader.js`**
- 异步加载三个 JSON 文件
- `getValuesForDate(date)` — 返回该日期全部系列值
- `formatValue(value, units)` — 智能格式化：
  - 百万 →"$X.XB"，十亿 →"$X.XT"
  - 利率 →"X.XX%"
  - 无数据 →"N/A"

**Step 3.6: `js/time-selector.js`**
- `<select>` 下拉列表（格式 "Q1 2024"）+ `<input type="range">` 滑块
- 变更时触发 `diagram.updateValues(date)`

**Step 3.7: `js/tooltip.js`**
- 绝对定位 `<div>`，跟随鼠标
- 悬停节点：显示全名、类别、关联系列当前值
- 悬停边：显示交易类型、描述、利率、余额/交易量、数据来源

**Step 3.8: `js/sidebar.js`** — 三个可折叠面板
- **Transaction Types**：10 个按钮（对应原图的 ALL + 10 个类型），点击高亮关联边
- **Legend**：节点类别颜色图例 + 边线型图例
- **Glossary**：13 个术语，可搜索过滤

**Step 3.9: `js/app.js`** — 入口
```
DOMContentLoaded → DataLoader.load() → Diagram.render() →
TimeSelector.init(dates, callback) → Sidebar.init(types, glossary, callback)
→ 初始渲染最新日期
```

**Step 3.10: `index.html`**
- Header：标题 + 时间控件
- Main：diagram-container (75%) + sidebar (25%)
- Tooltip div
- D3.js v7 从 CDN 加载
- 全部 JS 文件按依赖顺序加载

**Step 3.11: CSS**
- `main.css`：CSS Grid 布局、字体、全局样式
- `diagram.css`：SVG 节点/边样式、hover 过渡（opacity 200ms）、`.dimmed { opacity: 0.12 }`
- `sidebar.css`：面板手风琴、Transaction Type 按钮、Glossary 搜索框

### Phase 4: 集成与调试
- 真实 FRED 数据接入图表
- 验证每条边的数值是否正确显示
- 无 FRED 数据的边显示 "N/A"（如部分 FX swaps、bilateral repos）
- 校验：抽取某日期某系列值，对比 FRED 网站

### Phase 5: 完善
- D3 zoom/pan 支持
- 打印友好 CSS (`@media print`)
- 初次提交并推送

---

## 关键技术要点

连线几何重构接口设计见 `edge_routing_interface_design.md`，用于后续把端点选择、路由搜索、冲突消解拆成独立模块。

### 连线类型与端点选择
- 自连：从图形甲到图形甲的弧线。
- 相连：从图形甲到图形乙的直线或折线。
  - 直线：中间没有穿过其他图形或区域。
  - 折线：连线端点的直线会穿过其他图形或区域，通过算法生成折线路径。
- 当前 `EDGES` 数据先统一标记为 `connected`，为后续新增 `self` 类型保留入口。

```javascript
function computeEdgePath(edge) {
  if (edge.connectionType === "self" || edge.source === edge.target) {
    const { start, end } = selectSelfLoopEndpoints(edge.source);
    return buildSelfLoopArc(start, end);
  }

  const { start, end } = selectConnectedEndpoints(edge.source, edge.target);
  return lineOfSightClear(start, end)
    ? buildStraightPath(start, end)
    : buildPolylinePath(start, end);
}
```

### 多边平行路径偏移
同一节点对有多条边（如 FHLB→US Banks 有 FHLB advances 和 Fed funds），需垂直偏移：
```javascript
function computeEdgePath(source, target, offsetIndex, totalEdges) {
  const mx = (source.x + target.x) / 2, my = (source.y + target.y) / 2;
  const dx = target.x - source.x, dy = target.y - source.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  const offset = (offsetIndex - (totalEdges-1)/2) * 30;
  return `M ${source.x},${source.y} Q ${mx+(-dy/len)*offset},${my+(dx/len)*offset} ${target.x},${target.y}`;
}
```

### 混合频率对齐
`export_json.py` 对齐所有系列到季度端点（"as-of"逻辑）：对每个季末日期，取各系列截至该日最新观测值。

### Transaction Type 高亮
点击 Transaction Type 按钮时，图表仅高亮该类型关联的所有边和端点节点，暗化其余。这复现了原图 "Tap a Transaction Type to isolate the associated funding flows" 的交互。

---

## 验证方案

| 步骤 | 验证内容 | 方法 |
|---|---|---|
| Phase 2 | FRED 数据下载成功 | `python3 data/fetch_fred_data.py` 无报错 |
| Phase 2 | SQLite 有数据 | `sqlite3 data/funding_flows.db "SELECT COUNT(*) FROM observations;"` |
| Phase 2 | JSON 有效 | `python3 -c "import json; print(len(json.load(open('data/json/time_series.json'))))"` |
| Phase 3 | 图表渲染 | `python3 -m http.server 8000` → 浏览器看到 13 个节点和全部边 |
| Phase 3 | Transaction Type 切换 | 点击各类型按钮，对应边高亮 |
| Phase 3 | 日期切换 | 更换日期，边上数值更新 |
| Phase 3 | 悬停提示 | 鼠标悬停节点/边，弹出详细信息 |
| Phase 3 | Glossary | 搜索 "GSE"，显示对应定义 |
| 最终 | 数据准确 | 抽取 WRESBAL 某日值，对比 FRED 网站 |

---

## 前置条件

- **FRED API Key**：用户已有（配置到 `.env` 文件）
- **Python 依赖**：`pip install fredapi pandas`
- **浏览器**：现代浏览器（Chrome/Firefox/Safari）