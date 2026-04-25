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

### 0.2 并行工作流总览

```
                ┌──────────────── Module A：数据管线扩容 ────────────────┐
                │   FRED 补全 → Treasury API → NY Fed API → 统一 JSON   │
                └────────────────┬───────────────────────────────────────┘
                                 │
       ┌─────────────────────────┼─────────────────────────────────┐
       │                         │                                 │
┌──────▼──────┐         ┌────────▼────────┐               ┌────────▼────────┐
│ Module B    │         │ Module C        │               │ Module E         │
│ 布局重构    │ ←─独立─→│ proxy 映射 +     │   ←依赖A的─→  │ 新连线 (SRF/DW/  │
│（双面板）   │         │ 节点/边数据绑定   │   完成 outputs│ Foreign RRP)    │
└─────────────┘         └─────────────────┘               └──────────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Module D (P1) │  价差通道 + 压力分位数着色
                         │ 价/量双层      │
                         └───────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Module F (P2) │  压力探针 dashboard（独立里程碑）
                         └───────────────┘
```

**并行关系**：
- **A、B 完全独立**：数据扩容与 SVG 布局重构不冲突，可同时启动
- **C 依赖 A 的产物**：需要新数据 JSON 才能在 `constants.js` 里绑定
- **E 依赖 A**：新边的数据来自 A 新拉取的系列
- **D 依赖 A + C**：需要价差数据 + 已绑定 proxy 的边
- **F 推迟到独立里程碑**

---

## 1. Module A — 数据管线扩容

> **负责人指引**：本模块替换/扩展 `data/` 目录下的 Python 流水线，最终产出新的 JSON 文件供前端消费。

### 1.1 目标

- 在现有 FRED 流水线基础上，新增 ~15 个核心系列；
- 新增独立的 **Treasury Fiscal Data** 拉取脚本（免认证 REST）；
- 新增独立的 **NY Fed Markets API** 拉取脚本（免认证 REST，含日内分位数）；
- 三类数据归一化进入同一个 SQLite 库 → 导出统一 JSON。

### 1.2 输出文件

```
data/
├── series_config.py          # 修改：新增 ~15 个 FRED 系列定义
├── treasury_config.py        # 新建：Treasury 端点配置
├── nyfed_config.py           # 新建：NY Fed Markets 端点配置
├── fetch_fred_data.py        # 修改：兼容新系列
├── fetch_treasury_data.py    # 新建
├── fetch_nyfed_data.py       # 新建
├── build_database.py         # 修改：增加新表 schema
├── export_json.py            # 修改：导出新增字段
└── json/                     # 新增产物
    ├── fed_balance_sheet.json   # FED 资产负债表口径汇总
    ├── treasury_flows.json      # TGA / 拍卖 / 净发行
    ├── nyfed_operations.json    # ON RRP / SRF / SOFR 分位数
    └── pressure_indicators.json # 派生指标（spread、99分位差）
```

### 1.3 任务清单

#### A1. 扩充 FRED 系列配置

- [ ] 修改 `data/series_config.py`，按下列分组新增字段：

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

- [ ] 在文件头部加入 `group` 字段说明，方便 `export_json.py` 按组导出
- [ ] 跑 `python3 fetch_fred_data.py --series-only WRESBAL,SOFR,IORB` 验证新增系列可拉取

#### A2. Treasury Fiscal Data 拉取脚本

- [ ] 新建 `data/treasury_config.py`：

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

- [ ] 新建 `data/fetch_treasury_data.py`：

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

- [ ] 验收：`python3 data/fetch_treasury_data.py` 执行成功，`data/raw/treasury/tga_daily.json` 有 ≥ 3000 行（约 13 年日数据）

#### A3. NY Fed Markets API 拉取脚本

- [ ] 新建 `data/nyfed_config.py`：

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

- [ ] 新建 `data/fetch_nyfed_data.py`：

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

- [ ] 验收：`data/raw/nyfed/sofr.json` 至少包含 `percentPercentile99` 字段

#### A4. 数据库 schema 扩展

- [ ] 修改 `data/build_database.py`，新增三张表：

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

- [ ] 增加加载函数 `load_treasury()` 与 `load_nyfed()`，从 `raw/` 目录读取 JSON 写入 SQLite
- [ ] 增加派生指标计算：

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

- [ ] 修改 `data/export_json.py`，新增四个导出函数：
  - `export_fed_balance_sheet()` → `fed_balance_sheet.json`
  - `export_treasury_flows()` → `treasury_flows.json`
  - `export_nyfed_operations()` → `nyfed_operations.json`
  - `export_pressure_indicators()` → `pressure_indicators.json`

- [ ] 保持原有 `time_series.json` 兼容性（前端老路径不破坏）

### 1.4 验收（Module A）

```bash
cd data
# 1. 全量拉取
python3 fetch_fred_data.py
python3 fetch_treasury_data.py
python3 fetch_nyfed_data.py
# 2. 入库
python3 build_database.py
# 3. 导出 JSON
python3 export_json.py

# 4. 验收检查
python3 -c "
import json, pathlib
files = ['fed_balance_sheet.json','treasury_flows.json',
         'nyfed_operations.json','pressure_indicators.json',
         'available_dates.json','time_series.json']
for f in files:
    p = pathlib.Path('json')/f
    assert p.exists(), f'缺失 {f}'
    data = json.loads(p.read_text())
    print(f'[OK] {f} keys={list(data)[:3]} size_kb={p.stat().st_size//1024}')
"
```

**通过标准**：6 个 JSON 全部存在，`pressure_indicators.json` 中 `sofr_iorb_spread_bps` 至少有 1500 个观测值。

---

## 2. Module B — 双面板布局重构（与 A 完全并行）

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

### 2.1 输出文件

```
js/
├── layout/                    # 新建子目录
│   ├── panels.js              # 面板层级数据 + 渲染
│   ├── grid.js                # 行/列布局工具
│   ├── routing.js             # Manhattan 路由 + 边束捆绑
│   └── collision.js           # 标签防重叠（forceCollide 包装）
├── constants.js               # 修改：节点坐标按面板层级重写
├── diagram.js                 # 修改：渲染顺序加入面板层
├── nodes.js                   # 修改：节点尺寸适配新分组
└── edges.js                   # 修改：替换路由逻辑
css/
└── diagram.css                # 修改：面板/虚线分组样式
```

### 2.2 任务清单

#### B1. 面板层级数据结构

- [ ] 新建 `js/layout/panels.js`：

```javascript
// js/layout/panels.js
// 面板与分组层级（与 SVG viewBox 2150×1280 对齐）
export const PANELS = {
  fed: {
    id: "panel_fed",
    label: "FEDERAL RESERVE",
    level: 1,
    x: 20, y: 30, width: 520, height: 1220,
    children: [{
      id: "fed_balance_sheet",
      label: "BALANCE SHEET",
      level: 2,
      x: 45, y: 75, width: 470, height: 1175,
      columns: [
        { id: "fed_assets",      label: "Assets",      x: 50,  width: 210 },
        { id: "fed_liabilities", label: "Liabilities", x: 280, width: 210 },
      ],
    }],
  },
  market: {
    id: "panel_market",
    label: "U.S. DOLLAR FUNDING MARKET",
    level: 1,
    x: 560, y: 30, width: 1420, height: 1220,
    children: [
      {
        id: "onshore",
        label: "ONSHORE ENTITIES",
        level: 2,
        x: 580, y: 75, width: 940, height: 1175,
        children: [
          { id: "banks_dealers",  label: "Banks and Dealers",      level: 3,
            x: 600, y: 105, width: 905, height: 300 },
          { id: "onshore_invest", label: "Onshore Investors",       level: 3,
            x: 600, y: 415, width: 905, height: 520 },
          { id: "us_gov",         label: "U.S. Government Entities",level: 3,
            x: 600, y: 945, width: 905, height: 230 },
        ],
      },
      {
        id: "offshore",
        label: "OFFSHORE ENTITIES",
        level: 2,
        x: 1540, y: 75, width: 260, height: 1175,
      },
    ],
  },
};

// 虚线分组（dashed group）—— 包裹相邻节点，视觉聚合
export const DASH_GROUPS = [
  { id: "dash_banks_pair",   parent: "banks_dealers",
    members: ["us_banks", "us_branches"],
    label: null /* 不显文字标签，仅边框 */ },
  { id: "dash_mmf_row",      parent: "onshore_invest",
    members: ["gov_mmf", "prime_mmf"], label: "Money Market Funds" },
  { id: "dash_investor_group", parent: "onshore_invest",
    members: ["sec_lenders", "corporates", "fcb_swf", "hedge_funds"],
    label: null },
  { id: "dash_gse_pair",     parent: "us_gov",
    members: ["fhlb", "gses"], label: null },
  { id: "offshore_investors", parent: "offshore",
    members: ["foreign_insurers", "foreign_banks", "offshore_corporates"],
    label: "Offshore Investors" },
];
```

#### B2. 节点坐标重映射

- [ ] 修改 `js/constants.js`，按 panels.js 的容器位置重新指定每个节点的 `(x, y)`：

```javascript
// js/constants.js — 节点坐标片段（替换原 NODES 数组）
export const NODES = [
  // === Fed Balance Sheet 列 ===
  { id: "fed_assets_label",      label: "Assets",      panel: "fed_assets",
    x: 155, y: 110, width: 200, height: 0, type: "header" },
  { id: "fed_securities",        label: "Securities Held Outright", panel: "fed_assets",
    x: 155, y: 200, width: 200, height: 60 },
  { id: "fed_repo_assets",       label: "Repos / SRF",   panel: "fed_assets",
    x: 155, y: 280, width: 200, height: 60 },
  { id: "fed_lending",           label: "Discount Window", panel: "fed_assets",
    x: 155, y: 360, width: 200, height: 60 },
  { id: "fed_swaplines",         label: "FX Swap Lines", panel: "fed_assets",
    x: 155, y: 440, width: 200, height: 60 },

  { id: "fed_liab_label",        label: "Liabilities", panel: "fed_liabilities",
    x: 385, y: 110, width: 200, height: 0, type: "header" },
  { id: "fed_currency",          label: "Currency in Circ.", panel: "fed_liabilities",
    x: 385, y: 200, width: 200, height: 60 },
  { id: "fed_reserves",          label: "Reserve Balances", panel: "fed_liabilities",
    x: 385, y: 280, width: 200, height: 60 },
  { id: "fed_rrp_liab",          label: "ON RRP",           panel: "fed_liabilities",
    x: 385, y: 360, width: 200, height: 60 },
  { id: "fed_tga",               label: "TGA",              panel: "fed_liabilities",
    x: 385, y: 440, width: 200, height: 60 },

  // === Banks and Dealers ===
  { id: "us_banks",              label: "U.S. Banks",      panel: "banks_dealers",
    x: 700, y: 200, width: 180, height: 80 },
  { id: "us_branches",           label: "U.S. Branches (FBO)", panel: "banks_dealers",
    x: 920, y: 200, width: 180, height: 80 },
  { id: "broker_dealers",        label: "Broker-Dealers",  panel: "banks_dealers",
    x: 1180, y: 200, width: 180, height: 80 },
  { id: "fhlb_advances",         label: "FHLB (advances)", panel: "banks_dealers",
    x: 1380, y: 200, width: 130, height: 80 },

  // === Onshore Investors ===
  { id: "gov_mmf",               label: "Govt MMF",  panel: "onshore_invest",
    x: 700, y: 480, width: 180, height: 75 },
  { id: "prime_mmf",             label: "Prime MMF", panel: "onshore_invest",
    x: 920, y: 480, width: 180, height: 75 },
  { id: "sec_lenders",           label: "Securities Lenders", panel: "onshore_invest",
    x: 700, y: 620, width: 180, height: 75 },
  { id: "corporates",            label: "Corporates",         panel: "onshore_invest",
    x: 920, y: 620, width: 180, height: 75 },
  { id: "fcb_swf",               label: "FCBs / Supras / SWFs", panel: "onshore_invest",
    x: 1140, y: 620, width: 180, height: 75 },
  { id: "hedge_funds",           label: "Hedge Funds",        panel: "onshore_invest",
    x: 1360, y: 620, width: 140, height: 75 },
  { id: "dfmu",                  label: "DFMUs / FICC",       panel: "onshore_invest",
    x: 1140, y: 800, width: 180, height: 75 },

  // === U.S. Government ===
  { id: "treasury",              label: "U.S. Treasury",      panel: "us_gov",
    x: 700, y: 1020, width: 180, height: 75 },
  { id: "fhlb",                  label: "FHLB",               panel: "us_gov",
    x: 920, y: 1020, width: 180, height: 75 },
  { id: "gses",                  label: "GSEs",               panel: "us_gov",
    x: 1100, y: 1020, width: 180, height: 75 },

  // === Offshore ===
  { id: "foreign_insurers",      label: "Foreign Insurers",   panel: "offshore",
    x: 1620, y: 200, width: 160, height: 70 },
  { id: "foreign_banks",         label: "Foreign Banks",      panel: "offshore",
    x: 1620, y: 480, width: 160, height: 70 },
  { id: "offshore_corporates",   label: "Offshore Corporates", panel: "offshore",
    x: 1620, y: 760, width: 160, height: 70 },
];
```

> 上述坐标为初稿，最终需根据浏览器实际渲染**手动微调** ±20px。建议做完 B3 后用 Chrome DevTools 截图核对。

#### B3. 面板渲染层

- [ ] 在 `js/diagram.js` 的初始化阶段插入面板绘制（**在节点和边之前渲染**，作为最底层）：

```javascript
// js/diagram.js — 新增片段
import { PANELS, DASH_GROUPS } from "./layout/panels.js";

function renderPanels(svg) {
  const panelLayer = svg.append("g").attr("class", "layer-panels");

  function drawPanel(g, p) {
    g.append("rect")
      .attr("class", `panel panel-l${p.level}`)
      .attr("x", p.x).attr("y", p.y)
      .attr("width", p.width).attr("height", p.height)
      .attr("rx", 6);
    if (p.label) {
      g.append("text")
        .attr("class", `panel-label panel-label-l${p.level}`)
        .attr("x", p.x + 14).attr("y", p.y + 22)
        .text(p.label);
    }
    (p.children || []).forEach(c => drawPanel(g, c));
  }

  Object.values(PANELS).forEach(p => drawPanel(panelLayer, p));
}

function renderDashGroups(svg, nodes) {
  const dashLayer = svg.append("g").attr("class", "layer-dash-groups");
  const idx = Object.fromEntries(nodes.map(n => [n.id, n]));

  DASH_GROUPS.forEach(g => {
    const members = g.members.map(id => idx[id]).filter(Boolean);
    if (!members.length) return;
    const xs = members.map(m => m.x);
    const ys = members.map(m => m.y);
    const xe = members.map(m => m.x + m.width);
    const ye = members.map(m => m.y + m.height);
    const pad = 12;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    const w = Math.max(...xe) - x + pad;
    const h = Math.max(...ye) - y + pad;

    const grp = dashLayer.append("g").attr("class", "dash-group");
    grp.append("rect")
      .attr("class", "dash-frame")
      .attr("x", x).attr("y", y).attr("width", w).attr("height", h)
      .attr("rx", 4);
    if (g.label) {
      grp.append("text")
        .attr("class", "dash-label")
        .attr("x", x + 8).attr("y", y - 4)
        .text(g.label);
    }
  });
}

// 在 init() 中 SVG 创建后立即调用
// renderPanels(svg);  renderDashGroups(svg, NODES);
```

#### B4. Manhattan 路由

- [ ] 新建 `js/layout/routing.js`：

```javascript
// js/layout/routing.js
// 三段式 Manhattan 路由：源点→水平→垂直→目标点
// 通过"通道列"（gutter）走线，避免穿越节点矩形
import { PANELS } from "./panels.js";

const GUTTERS = {
  fed_market: 552,        // Fed 与 Market 之间的垂直通道
  banks_to_invest: 405,   // banks 区与 onshore_invest 区之间水平通道
  invest_to_gov: 935,     // onshore_invest 与 us_gov 间通道
  onshore_to_offshore: 1525,
};

export function routeManhattan(source, target, opts = {}) {
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  const gutter = opts.gutter ?? (sx + tx) / 2;

  // 三折线：(sx,sy) → (gutter,sy) → (gutter,ty) → (tx,ty)
  return `M ${sx} ${sy} L ${gutter} ${sy} L ${gutter} ${ty} L ${tx} ${ty}`;
}

export function routeBezier(source, target, opts = {}) {
  // 跨面板长边专用：贝塞尔
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  const cx = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`;
}

export function pickRouter(source, target) {
  // 同 panel 内 → Manhattan；跨 panel → Bezier
  return source.panel === target.panel ? routeManhattan : routeBezier;
}
```

- [ ] 修改 `js/edges.js`，把现有 `d3.line()` / 直线绘制替换为 `pickRouter` 输出的路径
- [ ] 把 `edge_routing_interface_design.md` 中预留的接口对接到 `routing.js`

#### B5. 边束捆绑（Edge Bundling）

- [ ] 在 `routing.js` 中新增 `bundleEdges(edges)`：把同源同终止区域的多条边聚为一束，前 30px 走同一路径再分叉。简化实现：

```javascript
// 同 source 节点出发的边，按 target.panel 分组，组内边在源点附近偏移
export function applyBundleOffset(edges) {
  const groups = {};
  edges.forEach(e => {
    const key = `${e.source}__${e.target_panel}`;
    (groups[key] ??= []).push(e);
  });
  for (const arr of Object.values(groups)) {
    if (arr.length <= 1) continue;
    arr.forEach((e, i) => {
      e._bundleOffset = (i - (arr.length - 1) / 2) * 8;  // ±8px 偏移
    });
  }
  return edges;
}
```

#### B6. CSS 样式

- [ ] 修改 `css/diagram.css`：

```css
/* css/diagram.css 追加 */
.layer-panels .panel {
  fill: none;
  stroke: #c8c8c8;
  stroke-width: 1.5;
}
.layer-panels .panel-l1 { stroke: #8a8a8a; stroke-width: 2; }
.layer-panels .panel-l2 { stroke: #b0b0b0; }
.layer-panels .panel-l3 { stroke: #d0d0d0; stroke-dasharray: none; }

.panel-label {
  font-family: -apple-system, "Segoe UI", sans-serif;
  fill: #555;
  font-weight: 600;
}
.panel-label-l1 { font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; }
.panel-label-l2 { font-size: 12px; fill: #777; }
.panel-label-l3 { font-size: 11px; fill: #888; }

.dash-frame {
  fill: none;
  stroke: #9aa0a6;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.dash-label {
  font-size: 10px;
  fill: #666;
  font-style: italic;
}
```

### 2.3 验收（Module B）

```bash
# 启动本地服务
python3 -m http.server 8000
# 在浏览器打开 http://localhost:8000
```

**通过标准**（手动核对）：
1. 看到左右两个 level=1 面板，标题 "FEDERAL RESERVE" 与 "U.S. DOLLAR FUNDING MARKET" 清晰
2. 右侧面板内嵌 ONSHORE / OFFSHORE 两个 level=2 容器
3. ONSHORE 内部有三个 level=3 子容器（Banks and Dealers / Onshore Investors / U.S. Gov）
4. 5 个虚线分组正确包裹相应节点
5. **没有任何边穿过节点矩形**（重点）
6. **Fed → Market 跨面板边只走一条贝塞尔曲线**，同 panel 内边走 Manhattan

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

- [ ] 新建 `js/proxy_registry.js`：

```javascript
// js/proxy_registry.js
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

- [ ] 修改 `js/constants.js`，让每个 NODE / EDGE 引用 `NODE_PROXIES` / `EDGE_PROXIES`：

```javascript
// js/constants.js 顶部
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

- [ ] 修改 `js/tooltip.js`：当 hover 节点/边时，从 `node.proxy` / `edge.proxy` 读取 `primary.series` 并查询 `dataLoader` 获取最新值
- [ ] 修改 `js/nodes.js`：节点徽章右上角显示 proxy 主指标的最新值（格式见 `dataLoader.formatValue()`）
- [ ] 对 `proxy_status: "not_found"` 的节点，徽章显示灰色 "n/a"
- [ ] 对 `proxy_status: "external" / "partial"` 的节点，徽章右下角加小图标 ⓘ，hover 显示获取方式说明

#### C4. 人类可读的论证文档

- [ ] 新建 `docs/proxy_mapping.md`，按节点/边各一张表，列出：
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
import('./js/proxy_registry.js').then(m => {
  console.log('nodes:', Object.keys(m.NODE_PROXIES).length,
              'edges:', Object.keys(m.EDGE_PROXIES).length);
});
```

不强制阻塞——proxy 缺失不会影响图表渲染，仅徽章显示 n/a。

---

## 4. Module E — 新增三条连线（依赖 A）

### 4.1 任务清单

- [ ] 修改 `js/constants.js` 的 `EDGES`，新增三条：

```javascript
// js/constants.js — EDGES 新增片段
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

- [ ] 在 `js/sidebar.js` 的 Transaction Types 列表中追加这三类，含图例颜色

> **自检建议（非阻塞）**：浏览器中点击 SRF / Discount Window / Foreign RRP 图例项，对应连线应高亮、其他变灰。

---

## 5. Module D — 价差通道（P1，依赖 A + C）

> 仅在 A、C 完成后启动。本节给出最小可用版本；详细 dashboard 推迟至 Module F。

### 5.1 任务

- [ ] 修改 `js/edges.js`：每条边渲染时，根据 `edge.proxy.price_proxy` 计算"压力分位数"并染色：

```javascript
// js/edges.js — 新增片段
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
// js/sidebar.js 预留 hook
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