import type { ResearchReport, Hypothesis } from "@/types/domain";

export const mockReports: ResearchReport[] = [
  {
    id: "report-daily-20260414",
    type: "daily",
    title: "Causa 日报 — 2026-04-14",
    summary:
      "黑色板块价差结构持续分化，螺纹-热卷价差偏离触发套利预警；能化链受原油夜盘急跌拖累，PP/TA 跌幅分化；农产品棕榈油基差修复机会成立。整体风险偏好中性偏弱。",
    body: `**黑色**：螺纹-热卷价差跌至 -42 元/吨，偏离 60 日均值 2.8σ，触发跨品种套利预警。焦炭-焦煤炼焦利润压缩至近三年 5% 分位，减产预期升温，关注焦炭供应边际收紧节奏。

**有色**：沪铜-LME 比价跌至 7.82，进口窗口关闭，内外套机会出现。铝、锌暂无异常信号。

**能化**：WTI 原油夜盘急跌 -2.1%（EIA 库存超预期 +4.2M 桶），国内 PP 跟跌 -1.2%、TA 跟跌 -1.8%，跌幅分化产生相对强弱交易机会。MEG 跌幅较小，关注 PP/MEG 价差结构。

**农产品**：马来西亚棕榈油 BMD 单日涨幅 +3.2%，国内 P2506 跟涨滞后，基差走弱，存在买入国内 P 的基差修复机会。豆油、豆粕暂无异常。

**海外**：美元指数小幅走强，有色承压；CBOT 大豆持稳，国内豆系暂无显著传导。`,
    hypotheses: [],
    relatedStrategyIds: ["strat-003", "strat-002", "strat-001"],
    relatedAlertIds: ["alert-001", "alert-002", "alert-003", "alert-004", "alert-005"],
    publishedAt: "2026-04-14T07:00:00Z",
  },
  {
    id: "report-weekly-20260413",
    type: "weekly",
    title: "Causa 周报 — 2026 W15（4.7–4.13）",
    summary:
      "本周黑色板块整体承压，螺纹-热卷价差持续走弱；能化链随原油下跌；有色铜内外比价接近套利临界点；农产品棕油-豆油价差季节性特征明显。共触发 12 条预警，8 条有效，预警准确率 66.7%。",
    body: `本周有效预警：8 条（黑色 3、有色 2、能化 2、农产品 1）。

**复盘**：
- 螺纹-热卷价差预警（W14）：触发后价差继续扩大，信号提前，持仓控制重要。
- 铜内外比价预警（W14）：比价持续走弱，当前接近触发区间，信号有效。
- 棕油-豆油价差：季节性特征符合预期，基差修复机会存在但时间窗口短。

**新 Hypothesis**：
1. 焦炭-焦煤利润压缩 → 减产 → 焦炭供应收紧路径（当前处于观察阶段）
2. 原油急跌后能化品种分化交易（高频，持续跟踪中）

**失效模式**：本周 4 条预警失效，主因：政策窗口期扰动（2条）、流动性不足无法执行（1条）、信号时间过早（1条）。`,
    hypotheses: [],
    relatedStrategyIds: ["strat-001", "strat-002", "strat-003", "strat-004", "strat-005"],
    relatedAlertIds: ["alert-001", "alert-002"],
    publishedAt: "2026-04-13T18:00:00Z",
  },
];

export const mockHypotheses: Hypothesis[] = [
  {
    id: "hyp-001",
    title: "螺纹-热卷价差均值回归",
    description: "出口需求分化导致 HC 相对强势，RB-HC 价差历史上在 2.5σ 以上偏离时均值回归概率 > 75%。",
    confidence: 0.87,
    status: "validated",
    createdAt: "2026-04-10T10:00:00Z",
  },
  {
    id: "hyp-002",
    title: "炼焦利润压缩 → 焦炭减产路径",
    description: "焦化利润跌破 -30 元/吨时，焦化厂平均减产响应周期约 2–3 周，焦炭供应收紧预期先于价格反应。",
    confidence: 0.71,
    status: "monitoring",
    createdAt: "2026-04-08T09:00:00Z",
  },
  {
    id: "hyp-003",
    title: "铜内外比价进口窗口关闭后均值回归",
    description: "SHFE/LME 比价跌破盈亏平衡点时，受套利资金驱动，比价平均在 5–10 个交易日内修复。",
    confidence: 0.79,
    status: "monitoring",
    createdAt: "2026-04-12T08:00:00Z",
  },
  {
    id: "hyp-004",
    title: "原油急跌后能化品种跌幅分化",
    description: "原油单日跌幅 ≥ 2% 时，PP/L/TA/MEG 四个品种跌幅标准差约 0.6%，存在可交易的相对强弱机会。",
    confidence: 0.68,
    status: "new",
    createdAt: "2026-04-14T03:00:00Z",
  },
  {
    id: "hyp-005",
    title: "棕榈油-豆油二季度季节性价差",
    description: "马来棕油二季度产量季节性回升，历史上 4–6 月 P-Y 价差趋于走阔，做空价差胜率 62%。",
    confidence: 0.61,
    status: "new",
    createdAt: "2026-04-05T10:00:00Z",
  },
  {
    id: "hyp-006",
    title: "郑棉-美棉内外比价失效案例",
    description: "内外棉比价受人民币汇率影响显著，上季度该信号触发后因汇率快速反向导致套利窗口关闭，信号需叠加汇率条件。",
    confidence: 0.35,
    status: "invalidated",
    createdAt: "2026-03-01T10:00:00Z",
  },
];
