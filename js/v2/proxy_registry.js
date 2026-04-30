/**
 * v2/proxy_registry.js — central mapping from node / edge identifiers to
 * data-series proxies that quantify their balance / flow.
 *
 * Schema (canonical, locked in decisions.md D-002, populated in S2.3):
 *
 *   "<node_id>": {
 *     primary: {
 *       proxy_id, source, frequency, units, metric?, note?,
 *     } | null,
 *     reason?: "<required when primary === null>",
 *     alternates: [ { proxy_id, source, frequency, units, ... }, ... ],
 *     theory:    "<≥50 字中文 — 经济传导 / 流动性机理>",
 *     empirical: {
 *       window: "36M_monthly",
 *       corr_36m: <number ∈ [-1,1] | null>,
 *       chart_path: "data/json/proxy_charts/<node_id>.json",
 *     },
 *     last_updated: "YYYY-MM-DD",
 *     script_path:  "data/<fetcher>.py" | null,
 *   }
 *
 * Source enum:    FRED | NYFed | Treasury | OFR | BIS | SIFMA | ICI | FHLB-OF | FHFA | CFTC | Derived
 * Frequency enum: D | W | M | Q | irregular
 * Units enum:     Mil. USD | Bil. USD | Percent | bps | Count | Index | Ratio
 *
 * Empirical numbers populated from data/json/proxy_empirical.json
 * (produced by data/proxy_validation.py, S2.2 harness).
 *
 * Risks tracked in .ief/risks.md:
 *   R008 — FRED series MBST / CURRCIR / H8B1058NCBCMG absent from current
 *          data/json snapshots; affected nodes carry corr_36m: null + R008
 *          note pending pipeline backfill at S4.1.
 *   R009 — bs_rrp / bs_rrp_omo series ID corrected RPONTSYD → RRPONTTLD
 *          (S2.3, decisions.md D-003).
 */

// ──────────────────────────────────────────────────────────────────────
// Node proxies (D-002 canonical schema)
// ──────────────────────────────────────────────────────────────────────
export const NODE_PROXIES = {
  // ── Fed balance-sheet liabilities & assets ────────────────────────
  bs_reserve_balances: {
    primary: { proxy_id: "WRESBAL", source: "FRED", frequency: "W", units: "Mil. USD" },
    alternates: [
      { proxy_id: "WALCL", source: "FRED", frequency: "W", units: "Mil. USD", note: "Total Fed assets — useful as a denominator / co-movement reference." },
    ],
    theory: "准备金余额是美联储净注入银行体系的流动性，与 IORB 共同决定银行间利率底部；QT 期 ΔWRESBAL 与 SOFR-IORB 价差呈负相关（约 -0.4），是观察银行准备金充裕度的核心指标。",
    empirical: { window: "36M_monthly", corr_36m: 0.4229, chart_path: "data/json/proxy_charts/bs_reserve_balances.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_tga: {
    primary: { proxy_id: "tga_balance_usd_m", source: "Treasury", frequency: "D", units: "Mil. USD" },
    alternates: [
      { proxy_id: "WTREGEN", source: "FRED", frequency: "W", units: "Mil. USD", note: "Same TGA balance via FRED H.4.1 weekly; cross-source ground truth." },
    ],
    theory: "财政部一般账户（TGA）是美联储负债端的另一蓄水池，TGA 抽水时私营部门流动性减少，与准备金余额呈典型的此消彼长关系（稳态 ρ ≈ -0.7~-0.9），是 Q5 ON RRP / 准备金边际变化的最重要外生驱动。",
    empirical: { window: "36M_monthly", corr_36m: 0.9834, chart_path: "data/json/proxy_charts/bs_tga.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_treasury_data.py",
  },

  bs_rrp: {
    primary: { proxy_id: "RRPONTTLD", source: "FRED", frequency: "D", units: "Bil. USD", note: "R009 fix S2.3 (was RPONTSYD)." },
    alternates: [
      { proxy_id: "rrp_ops", source: "NYFed", frequency: "D", units: "Mil. USD", metric: "amt_accepted", note: "NYFed daily OMO accepted amount; ground-truth source FRED ingests." },
    ],
    theory: "ON RRP 余额是美联储利率走廊下沿，主要由 MMF 持有；T-bill 收益率低于 RRP 利率时 MMF 把流动性留在 Fed，反之倒灌一级市场。RRP 余额是观察短端流动性过剩程度与 MMF 资产配置选择的关键变量，参与对手方数量领先实际使用 1-2 个月。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_rrp.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_rrp_omo: {
    primary: { proxy_id: "RRPONTTLD", source: "FRED", frequency: "D", units: "Bil. USD", note: "R009 fix S2.3 (was RPONTSYD); OMO is the dominant share of total operations." },
    alternates: [
      { proxy_id: "rrp_ops", source: "NYFed", frequency: "D", units: "Mil. USD", metric: "amt_accepted" },
    ],
    theory: "ON RRP 公开市场操作部分（不含外国央行回购池）是 RRP 总余额的主要构成，反映非外央行机构把美元停泊在 Fed 的规模；与 bs_rrp 共享 RRPONTTLD 作 primary，分立节点便于流向图区分外央行通道与 MMF 通道。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_rrp_omo.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_foreign_repo: {
    primary: { proxy_id: "WLRRAL", source: "FRED", frequency: "W", units: "Mil. USD", note: "Foreign repo pool sits inside total reverse repo liability." },
    alternates: [],
    theory: "外国央行回购池（Foreign Reverse Repo Pool）位于美联储 H.4.1 总反向回购负债（WLRRAL）内，是境外美元持有方将美元停泊在 Fed 的离岸蓄水池，与 ON RRP OMO 同属负债端但服务于不同对手方，规模长期稳定在 $300-400B。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_foreign_repo.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_primary_credit: {
    primary: { proxy_id: "WLCFLPCL", source: "FRED", frequency: "W", units: "Mil. USD" },
    alternates: [],
    theory: "贴现窗口一级信贷（Primary Credit）是银行向 Fed 借款的常规通道，由于信号污名（stigma）效应日常使用近零；任何非零余额都是流动性紧张事件的强信号（2023-03 SVB 周峰值 $150B+），是观察银行融资紧张的尾部指标。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_primary_credit.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_cb_swaps: {
    primary: { proxy_id: "H41RESPPALDKNWW", source: "FRED", frequency: "W", units: "Mil. USD" },
    alternates: [],
    theory: "中央银行美元流动性互换（CB Liquidity Swaps）是美联储与 ECB/BoJ/BoE/SNB/BoC 等主要央行之间的常设互换协议，2020-03 与 2023-03 两次激增是离岸美元紧张的教科书指标，平时近零。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_cb_swaps.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_treasuries: {
    primary: { proxy_id: "TREAST", source: "FRED", frequency: "W", units: "Mil. USD" },
    alternates: [],
    theory: "美联储持有的国债资产规模是 QE / QT 节奏的直接读数，QT 期月度净缩减约 $60B（2022-09 起的 cap），是评估广义美元流动性净流出的核心资产端变量。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/bs_treasuries.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_other_liab: {
    primary: null,
    reason: "S2.4-confirmed null (D-004): residual H.4.1 'other liabilities' bucket has no clean single public proxy; OFR / FHLB-OF / FHFA do not address residual Fed liability lines. Maintained as a topology placeholder; no fetcher will be added.",
    alternates: [],
    theory: "Fed 资产负债表「其他负债」科目是一个残差篮子，包含外汇负债、待结算、应计费用等小额条目，整体规模波动小且无单一公开代理；本节点保留以维持 v2 节点拓扑完整性，但暂不显示数值。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/bs_other_liab.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  bs_fhlb_deposits: {
    primary: null,
    reason: "S2.4-deferred (D-004): the H.4.1 'FHLB / DFMU / GSE deposits' sub-line is published only inside the H.4.1 PDF release (no FRED series ID, no JSON endpoint). FHLB-OF monthly Excel was the planned source but is deferred along with the FHLB-OF parser. Maintained as a topology placeholder.",
    alternates: [],
    theory: "联邦住房贷款银行（FHLB）等政府支持机构的 Fed 存款余额，是无息储备外的另一负债通道，在 2019-09 回购紧张期间因 GSE 提款触发了短端利率冲击，节点存在但当前无公共日频序列代理。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/bs_fhlb_deposits.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  bs_fed_notes: {
    primary: { proxy_id: "CURRCIR", source: "FRED", frequency: "M", units: "Bil. USD", note: "S4.1 R008 unblock (D-007 Part C): live FRED metadata is monthly + Bil. USD (was W + Mil. USD in S2.3 placeholder); series flagged DISCONTINUED at FRED but still publishing through 2025-10." },
    alternates: [],
    theory: "流通中的美联储票据（Federal Reserve Notes / 现钞）是结构性慢变量，规模缓慢上升反映现金需求，与 reserve balances 互为美联储负债侧的两大常态科目，季节性（节假日）效应主导短期波动。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, samples: 154, chart_path: "data/json/proxy_charts/bs_fed_notes.json", note: "S4.1: self-anchored against CURRCIR; series flagged DISCONTINUED but published through 2025-10." },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_agency_mbs: {
    primary: { proxy_id: "MBST", source: "FRED", frequency: "W", units: "Mil. USD", note: "S4.1 R008 unblock (D-007 Part C): MBST is DISCONTINUED at FRED on 2018-06-13 — historical levels are accurate but the series has not updated since; D-006 stale-grey path will mark current obs as strongly stale. Promotion of a live alternate (e.g. WSHOMCB) deferred to P4 retro." },
    alternates: [],
    theory: "美联储持有的机构 MBS 资产规模与 QE / QT 政策同步运动，QT 期受月度 cap 控制（约 $35B 上限）的被动 runoff 决定缩表斜率，是美联储资产端继 TREAST 国债之后的第二大科目，规模波动直接影响广义美元基础。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, samples: 66, chart_path: "data/json/proxy_charts/bs_agency_mbs.json", note: "S4.1: self-anchored on the 2013-2018 sample window; MBST DISCONTINUED 2018-06-13 so post-2018 = no data (D-006 stale-grey will surface this)." },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  bs_foreign_reserves: {
    primary: null,
    reason: "S2.4-confirmed null (D-004): H.4.1 foreign-currency holdings is a small static line (<$20B) without a dedicated FRED series ID; whitelist sources do not publish a daily/weekly substitute. Maintained as a topology placeholder.",
    alternates: [],
    theory: "美联储持有的外币储备（Foreign Currency Holdings）作为 SDR 与互换协议的清算媒介存在，规模长期稳定在 $20B 以下，对美元流动性传导的边际影响极小，节点保留以呈现完整资产端结构。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/bs_foreign_reserves.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  bs_others_assets: {
    primary: null,
    reason: "S2.4-confirmed null (D-004): H.4.1 asset-side residual bucket; same disposition as bs_other_liab — no clean public proxy in the D-001 IN-set; maintained as a topology placeholder.",
    alternates: [],
    theory: "美联储资产端「其他资产」科目是包含 SDR 持有、premium / discount 调整、Maiden Lane 残余等条目的混合篮子，整体规模稳定但内部构成变化复杂，无单一公共代理可对应，节点保留以呈现完整的资产端结构布局。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/bs_others_assets.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  // ── Banks & dealers (right-panel hexagons) ────────────────────────
  us_banks: {
    primary: { proxy_id: "TOTBKCR", source: "FRED", frequency: "W", units: "Bil. USD" },
    alternates: [],
    theory: "美国商业银行总信贷（H.8 Total Bank Credit）反映银行资产端规模，存款外流时迫使银行转向批发融资市场（联邦基金 / 回购 / FHLB advances），是观察银行业批发融资依赖度的母变量。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/us_banks.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  us_fbo: {
    primary: null,
    reason: "S4.1-confirmed null (D-007 Part C): live FRED metadata audit reveals H8B1058NCBCMG is 'Deposits, All Commercial Banks, Percent Change at Annual Rate' (NOT a foreign-related bank credit level series). No public single-series stock proxy located within D-001 IN-set for in-US foreign-banking-office credit balances; demoted from primary. Future-cycle candidate: BIS locational banking statistics (P4 retro).",
    alternates: [],
    theory: "在美外资银行分行（Foreign Banking Offices, FBO）没有零售存款基础，主要依赖 FX swap 加 IORB 套利组合获得美元资金，是 ON RRP / IORB 利率走廊的边际玩家与离岸美元回流到美国境内市场的关键桥梁性主体。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/us_fbo.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  dealers: {
    primary: { proxy_id: "primary_dealer_ust_position", source: "NYFed", frequency: "W", units: "Mil. USD", metric: "PDPOSGST-TOT", note: "NYFed Primary Dealer Statistics: total UST securities (excl. TIPS) net dealer position. S2.4 fetcher: data/fetch_nyfed_pd_data.py." },
    alternates: [
      { proxy_id: "primary_dealer_agency_position", source: "NYFed", frequency: "W", units: "Mil. USD", metric: "PDPOSFGS-TOT", note: "Federal agency + GSE securities (excl. MBS) net position." },
      { proxy_id: "primary_dealer_mbs_position", source: "NYFed", frequency: "W", units: "Mil. USD", metric: "PDPOSMBS-TOT", note: "Agency MBS net position." },
    ],
    theory: "一级交易商（Primary Dealers）是 SLR 约束下国债与回购市场的核心做市方，其 UST 净持仓（PDPOSGST-TOT）是资产负债表报价容量与意愿的直读；2019-09 与 2024-Q4 SOFR 跳升都伴随 dealer book 择量压力上升，是批发市场流动性供给能力的核心变量。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/dealers.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_nyfed_pd_data.py",
  },

  // ── Onshore investors ─────────────────────────────────────────────
  retail_investors: {
    primary: null,
    reason: "S2.4-deferred (D-004): the cleanest public proxy is ICI weekly retail money-fund AUM, which requires an HTML/CSV scraper of the ICI weekly release page — not in the FRED/Treasury/NYFed/OFR/CFTC fetcher families implemented in S2.4. Defer to a future iteration; gov_mmf + prime_mmf together envelope retail-driven flow scale.",
    alternates: [],
    theory: "零售投资者（家庭与小型机构）通过零售 MMF、活期存款、可转让存单参与短端市场，对 ON RRP 影响有限但对存款外流（2023 银行危机）敏感；公开高频代理稀缺，需借助 ICI 周度货币基金净流入。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/retail_investors.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  gov_mmf: {
    primary: { proxy_id: "ofr_mmf_treasury_repo_total", source: "OFR", frequency: "M", units: "Bil. USD", metric: "MMF-MMF_T_TOT-M", note: "OFR MMF Monitor: Treasury-collateralized repo holdings across MMF complex (Government MMFs dominate this bucket; portfolio-side proxy for gov-MMF scale). S2.4 fetcher: data/fetch_ofr_data.py." },
    alternates: [
      { proxy_id: "MMMFFAQ027S", source: "FRED", frequency: "Q", units: "Mil. USD", note: "Z.1 quarterly money fund total assets — lower-frequency cross-source." },
      { proxy_id: "ofr_mmf_total", source: "OFR", frequency: "M", units: "Bil. USD", metric: "MMF-MMF_TOT-M", note: "Total MMF AUM (gov + prime + tax-exempt) — envelope check." },
    ],
    theory: "政府型货币市场基金（Government MMF）是美联储 ON RRP 工具的最大单一对手方，主要决定流动性是继续停泊在 Fed 还是回流到国库券一级市场。采用 OFR T_TOT（gov MMF 主导的 Treasury 抵押品回购余额月度汇总）作为代理，与 RRPONTTLD 呈现强负相关（实证 ρ≈-0.97/153M）：当 T-bill 收益率高于 RRP 利率时，gov MMF 从 RRP 退出转持 Treasury 抵押品回购，两者为金额替代关系。",
    empirical: { window: "36M_monthly", corr_36m: -0.9651, chart_path: "data/json/proxy_charts/gov_mmf.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_ofr_data.py",
  },

  prime_mmf: {
    primary: { proxy_id: "ofr_mmf_other_assets_total", source: "OFR", frequency: "M", units: "Bil. USD", metric: "MMF-MMF_OA_TOT-M", note: "OFR MMF Monitor: non-Treasury repo holdings (Prime + Tax-Exempt funds dominate; portfolio-side proxy for prime-MMF scale). S2.4 fetcher: data/fetch_ofr_data.py." },
    alternates: [
      { proxy_id: "ofr_mmf_total", source: "OFR", frequency: "M", units: "Bil. USD", metric: "MMF-MMF_TOT-M", note: "Total MMF AUM — envelope check." },
    ],
    theory: "Prime 货币市场基金是商业票据（CP）市场和欧洲美元（Eurodollar）批发市场的主要机构买方，2016 年 SEC 监管改革后行业规模显著缩水至万亿以下；其余额变动是衡量短端非主权信用需求与离岸美元配置偏好的核心变量。OFR OA_TOT （非Treasury 抵押品回购）是 Prime+Tax-Exempt 资金主导的报价额。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/prime_mmf.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_ofr_data.py",
  },

  securities_lenders: {
    primary: null,
    reason: "S2.4-deferred (D-004): NYFed soma_summary endpoint does not expose a `seclending` column (verified S2.4); the dedicated /api/seclending/... endpoints all return HTTP 400 without authenticated parameters. Defer; OFR Tri-party repo overnight volume (REPO-TRI_TV_OO-P) covers the closely-related lendable-cash leg via the hedge_funds entry's alternates.",
    alternates: [
      { proxy_id: "ofr_repo_triparty_overnight_volume", source: "OFR", frequency: "D", units: "Bil. USD", metric: "REPO-TRI_TV_OO-P", note: "Tri-party overnight repo volume — indirect proxy for sec-lender cash deployment." },
    ],
    theory: "证券借出方（如 BNY Mellon、State Street）通过证券借贷市场提供国债 / 机构 MBS，借出量上升表明现金端供给充裕、抵押品端紧张；SOMA 二级市场借出量是 specialness 的领先指标。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/securities_lenders.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  corporates_onshore: {
    primary: { proxy_id: "COMPAPER", source: "FRED", frequency: "W", units: "Bil. USD" },
    alternates: [],
    theory: "境内企业（Non-Financial Corporates）通过商业票据（CP）市场进行短期融资，CP 净发行量与 DCPN30-OIS 价差在压力期反向运动（价差扩大、净发行萎缩），是观察企业短期融资压力的核心代理。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/corporates_onshore.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  fcb_swf_supra_onshore: {
    primary: { proxy_id: "WLRRAL", source: "FRED", frequency: "W", units: "Mil. USD", note: "Onshore mirror of foreign repo pool — same series as fcb_swf_supra_offshore by construction." },
    alternates: [],
    theory: "外国央行 / 主权财富基金 / 国际机构在岸通道：通过纽约联储外国官方账户存放美元，其余额位于 H.4.1 反向回购总科目（WLRRAL）内，与 bs_foreign_repo 共享底层数据，节点分立用于在流向图区分对手方维度。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/fcb_swf_supra_onshore.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  hedge_funds: {
    primary: { proxy_id: "ofr_repo_dvp_overnight_volume", source: "OFR", frequency: "D", units: "Bil. USD", metric: "REPO-DVP_OV_OO-P", note: "OFR Repo Monitor: DVP overnight outstanding volume — FICC-cleared sponsored repo flows through this stream and is the canonical leverage indicator for hedge-fund cash-futures basis trades. S2.4 fetcher: data/fetch_ofr_data.py." },
    alternates: [
      { proxy_id: "tff_ust_10y_lev_money", source: "CFTC", frequency: "W", units: "Count", metric: "net_long", note: "CFTC TFF: leveraged-money net position in 10Y UST note futures (long−short). S2.4 fetcher: data/fetch_cftc_data.py." },
      { proxy_id: "tff_ust_2y_lev_money", source: "CFTC", frequency: "W", units: "Count", metric: "net_long", note: "CFTC TFF: 2Y UST note futures leveraged-money net position." },
      { proxy_id: "tff_ust_bond_lev_money", source: "CFTC", frequency: "W", units: "Count", metric: "net_long", note: "CFTC TFF: long-end UST bond futures leveraged-money net position." },
      { proxy_id: "ofr_repo_triparty_overnight_volume", source: "OFR", frequency: "D", units: "Bil. USD", metric: "REPO-TRI_TV_OO-P", note: "Tri-party overnight repo — venue cross-check." },
    ],
    theory: "对冲基金 2021 年之后通过 cash-futures basis trade 策略成为美国国债的边际买家，其 sponsored cleared repo 杠杆水平与 CFTC 期货空头持仓共同表征杠杆风险；OFR DVP overnight outstanding 是可调用的主要公共高频指标，2024-Q4 与 2024-09-30 SRF 工具余额跳升是可能的尾部传导渠道之一。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/hedge_funds.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_ofr_data.py",
  },

  // ── Government entities ───────────────────────────────────────────
  fhlb: {
    primary: null,
    reason: "S2.4-deferred (D-004): FHLB Office of Finance monthly advances / consolidated obligations are published as PDF + Excel only; no public JSON/CSV API exists. Implementing the parser is out-of-scope for the lightweight fetchers in S2.4 (no new pip dependencies); defer to a follow-up iteration. The FHLB-OF source remains in D-001 IN-set.",
    alternates: [
      { proxy_id: "fhlb_of_monthly", source: "FHLB-OF", frequency: "M", units: "Bil. USD", note: "FHLB-OF monthly report; pending Excel parser implementation." },
    ],
    theory: "联邦住房贷款银行（FHLB）系统是无息储备货币市场的最大单一短期债务发行方，2019-09 准备金抽离 + GSE 提款是触发回购利率冲击的关键事件，FHLB advances 余额与 EFFR-IORB 价差领先短端流动性紧张。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/fhlb.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  gse: {
    primary: null,
    reason: "S2.4-deferred (D-004): FHFA quarterly GSE conservator capital + monthly Mortgage Market Survey are published as PDF + Excel only; no public JSON/CSV API. Same disposition as fhlb — defer parser to a follow-up iteration; FHFA source remains in D-001 IN-set.",
    alternates: [
      { proxy_id: "fhfa_gse_holdings", source: "FHFA", frequency: "Q", units: "Bil. USD", note: "FHFA Fannie/Freddie/FHLB report; pending Excel parser implementation." },
    ],
    theory: "政府支持企业 GSE（Fannie Mae、Freddie Mac）作为非 IORB-eligible 主体在联邦基金市场以折价借出现金，是 EFFR-IORB 价差长期为负的核心结构性驱动；月末 GSE 资金调配波动通过批发回购传导直接影响次日 EFFR 与短端利率。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/gse.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  us_treasury: {
    primary: { proxy_id: "tga_balance_usd_m", source: "Treasury", frequency: "D", units: "Mil. USD" },
    alternates: [
      { proxy_id: "auctions_btc_by_term", source: "Treasury", frequency: "irregular", units: "Ratio", note: "Bid-to-cover by tenor — issuance health." },
      { proxy_id: "WTREGEN", source: "FRED", frequency: "W", units: "Mil. USD", note: "Cross-source TGA via Fed H.4.1." },
    ],
    theory: "美国财政部作为发行端通过 TGA 余额、拍卖中标率（bid-to-cover）和停标利率（high yield）三条线索描述发行节奏与一级市场吸纳能力，TGA 余额变动是 ON RRP / 准备金边际变动的最重要外生驱动。",
    empirical: { window: "36M_monthly", corr_36m: 0.9834, chart_path: "data/json/proxy_charts/us_treasury.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_treasury_data.py",
  },

  // ── Offshore entities ─────────────────────────────────────────────
  fcb_swf_supra_offshore: {
    primary: { proxy_id: "WLRRAL", source: "FRED", frequency: "W", units: "Mil. USD", note: "Offshore mirror — same foreign repo pool series as fcb_swf_supra_onshore." },
    alternates: [],
    theory: "外国央行 / 主权基金 / 国际清算机构离岸通道：境外持有美元的官方机构通过纽约联储外国回购池存放美元，规模反映全球央行储备美元化与 USD 净需求，2022-2023 期间稳定在 $300-400B。",
    empirical: { window: "36M_monthly", corr_36m: 1.0, chart_path: "data/json/proxy_charts/fcb_swf_supra_offshore.json" },
    last_updated: "2026-04-26",
    script_path: "data/fetch_fred_data.py",
  },

  foreign_insurers: {
    primary: null,
    reason: "permanent-not_found (D-001): 全球保险机构持有美元资产无公开日频/周频时间序列；NAIC 季度报表 + 部分主权监管披露是仅有的 indirect proxy，远不满足月度对齐要求；按 spec §Acceptance #3 显式置 null。",
    alternates: [],
    theory: "外国保险机构（尤其日本、欧洲寿险）持有大量美元资产并通过 FX swap 对冲，其再平衡决定 long-end USD 票据需求与基差走廊；公共数据无法满足时序覆盖，节点保留以呈现完整对手方拓扑。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/foreign_insurers.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  foreign_banks: {
    primary: null,
    reason: "S4.1-confirmed null (D-007 Part C): same H8B1058NCBCMG concept-mismatch as us_fbo (the FRED ID is a percent-change-of-deposits series, not a foreign-bank credit stock). No public single-series replacement located within the D-001 IN-set. Future-cycle candidate: BIS locational banking statistics (P4 retro).",
    alternates: [],
    theory: "境外银行总部（区别于 us_fbo 在美分支）持有大量美元负债，主要通过 FX swap 与 cross-currency basis 渠道对接美元流动性；S2.3 曾错误地以 H8B1058NCBCMG 为代理（误读 FRED 标题），S4.1 元数据审计纠正为 null。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/foreign_banks.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  corporates_offshore: {
    primary: null,
    reason: "permanent-not_found (D-001): 离岸美元企业现金管理无公共披露；公司层面与跨境层面均无标准化数据集，按 spec §Acceptance #3 显式置 null。",
    alternates: [],
    theory: "离岸跨国公司（尤其欧洲、亚洲非金融企业）通过欧洲美元存款 / CP 持有美元短期资产，其再投资偏好影响 prime MMF 与 Eurodollar 市场需求；公共数据缺位是结构性现实。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/corporates_offshore.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },

  offshore_mmf: {
    primary: null,
    reason: "S2.4-deferred (D-004): ICI Worldwide statistics quarterly tables are PDF/HTML only; no public JSON/CSV API. Defer; the ICI source remains in D-001 IN-set.",
    alternates: [
      { proxy_id: "ici_offshore_mmf_aum", source: "ICI", frequency: "Q", units: "Bil. USD", note: "ICI Worldwide quarterly; pending HTML parser implementation." },
    ],
    theory: "离岸 USD 货币基金（爱尔兰、卢森堡注册）服务于全球美元现金管理，是 prime MMF 在境外的镜像产品，其 AUM 与 BIS LBS 跨境美元负债共同刻画离岸美元流动性容量。",
    empirical: { window: "36M_monthly", corr_36m: null, chart_path: "data/json/proxy_charts/offshore_mmf.json" },
    last_updated: "2026-04-26",
    script_path: null,
  },
};

/** Convenience: return the proxy record for a node id, or null. */
export function getNodeProxy(nodeId) {
  return NODE_PROXIES[nodeId] ?? null;
}
