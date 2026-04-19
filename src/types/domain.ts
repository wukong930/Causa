// ─── Shared primitives ───────────────────────────────────────────────────────

export type Direction = "long" | "short";
export type SpreadModel =
  | "calendar_spread"
  | "cross_commodity"
  | "basis_trade"
  | "inter_market"
  | "triangular"
  | "event_driven"
  | "structural";

// ─── Alert ───────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertCategory =
  | "ferrous"
  | "nonferrous"
  | "energy"
  | "agriculture"
  | "overseas";
export type AlertStatus =
  | "active"
  | "expired"
  | "archived";
export type AlertType =
  | "spread_anomaly"
  | "basis_shift"
  | "momentum"
  | "event_driven"
  | "inventory_shock"
  | "regime_shift";

export interface SpreadInfo {
  leg1: string;
  leg2: string;
  currentSpread: number;
  historicalMean: number;
  sigma1Upper: number;
  sigma1Lower: number;
  zScore: number;
  halfLife: number; // days
  adfPValue: number;
  unit: string;
}

export interface TriggerStep {
  step: number;
  label: string;
  description: string;
  timestamp: string; // ISO 8601
  confidence: number; // 0–1
}

export interface Alert {
  id: string;
  title: string;
  summary: string;
  severity: AlertSeverity;
  category: AlertCategory;
  type: AlertType;
  status: AlertStatus;
  triggeredAt: string; // ISO 8601
  updatedAt: string;
  expiresAt?: string;
  confidence: number; // 0–1
  relatedAssets: string[];
  spreadInfo?: SpreadInfo;
  triggerChain: TriggerStep[];
  riskItems: string[];
  manualCheckItems: string[];
  plainSummary?: string;
  oneLiner?: string;
  // lifecycle linkage
  relatedStrategyId?: string;
  relatedRecommendationId?: string;
  relatedResearchId?: string;
  invalidationReason?: string;
}

// ─── Hypothesis primitives ────────────────────────────────────────────────────

export type HypothesisType = "spread" | "directional";

export interface HypothesisLeg {
  asset: string;       // e.g. "RB2501"
  direction: Direction;
  ratio: number;       // position sizing ratio, e.g. 1
  exchange: string;    // e.g. "SHFE"
  contractMonth?: string; // e.g. "2506"
}

export interface DirectionalLeg {
  asset: string;       // e.g. "RB2506"
  direction: Direction;
  exchange: string;    // e.g. "SHFE"
  contractMonth?: string;
  targetSize?: number; // 手数
  targetPct?: number;   // 资金占比%
}

// ─── Base hypothesis ─────────────────────────────────────────────────────────

export interface BaseHypothesis {
  id: string;
  type: HypothesisType;
  /** Natural language description of the trading hypothesis */
  hypothesisText: string;
  /** Alert or event that triggered this hypothesis */
  triggerDescription?: string;
  createdFromAlertId?: string;
  createdAt: string;
  lastUpdated: string;
}

// ─── SpreadHypothesis ────────────────────────────────────────────────────────

export interface SpreadHypothesis extends BaseHypothesis {
  type: "spread";
  spreadModel: SpreadModel;
  legs: HypothesisLeg[];
  entryThreshold: number;   // z-score threshold to enter
  exitThreshold: number;    // z-score threshold to exit
  stopLossThreshold: number;
  currentZScore: number;
  halfLife: number;          // days
  adfPValue: number;
  hurstExponent?: number;
  causalConfidence?: number; // 0–1, from DoWhy
  expectedSpread?: number;   // expected spread value at mean reversion
  maxDrawdown?: number;      // historical max drawdown
  /** Commodity category for this spread */
  category?: AlertCategory;
}

// ─── DirectionalHypothesis ──────────────────────────────────────────────────

export interface DirectionalHypothesis extends BaseHypothesis {
  type: "directional";
  leg: DirectionalLeg;
  /** Entry price when hypothesis was created */
  entryPrice?: number;
  /** Current market price */
  currentPrice?: number;
  /** Stop loss price */
  stopLoss?: number;
  /** Take profit price */
  takeProfit?: number;
  /** Conviction/confidence score 0–1 */
  confidence?: number;
  /** Risk/reward ratio */
  riskRewardRatio?: number;
  /** Position sizing: number of lots */
  positionSize?: number;
  /** Category of the asset */
  category?: AlertCategory;
  /** Momentum direction: 'up' | 'down' | 'neutral' */
  momentum?: "up" | "down" | "neutral";
}

// ─── Hypothesis union ────────────────────────────────────────────────────────

export type Hypothesis = SpreadHypothesis | DirectionalHypothesis;

// ─── StrategyPoolItem ────────────────────────────────────────────────────────

export type StrategyStatus =
  | "draft"
  | "active"
  | "approaching_trigger"
  | "paused"
  | "watch_only"
  | "retired";

export interface ValidationMetrics {
  hitRate: number;         // 0–1
  sampleCount: number;
  avgHoldingDays: number;
  costSpreadRatio: number; // fee / expected spread, lower is better
  stressLoss: number;      // max drawdown in currency
  sharpeRatio?: number;
}

export interface StrategyPoolItem {
  id: string;
  name: string;
  description: string;
  status: StrategyStatus;
  hypothesis: SpreadHypothesis;
  validation: ValidationMetrics;
  // linkages
  relatedAlertIds: string[];
  recommendationHistory: string[]; // Recommendation ids
  executionFeedbackIds: string[];
  // metadata
  createdAt: string;
  updatedAt: string;
  lastActivatedAt?: string;
  notes?: string;
}

// ─── Recommendation ──────────────────────────────────────────────────────────

export type RecommendedAction =
  | "new_open"
  | "add"
  | "reduce"
  | "close"
  | "hedge"
  | "replace"
  | "watchlist_only";

export type RecommendationStatus =
  | "active"
  | "expired"
  | "superseded";

export interface RecommendationLeg {
  asset: string;
  contractMonth?: string;
  direction: Direction;
  suggestedSize: number;
  unit: string;
  entryPriceRef?: number;
  entryZone?: [number, number];
  stopLoss?: number;
  takeProfit?: number;
}

export interface BacktestSummary {
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  oosStable: boolean;
  sampleSize: number;
}

export interface Recommendation {
  id: string;
  strategyId?: string;
  alertId?: string;
  status: RecommendationStatus;
  recommendedAction: RecommendedAction;
  legs: RecommendationLeg[];
  priorityScore: number;         // 0–100
  portfolioFitScore: number;     // 0–100
  marginEfficiencyScore: number; // 0–100
  marginRequired: number;        // currency
  reasoning: string;             // LangGraph natural language summary
  plainSummary?: string;         // Plain-language summary for non-experts
  oneLiner?: string;             // One-sentence LLM-generated summary
  riskItems: string[];
  expiresAt: string;             // ISO 8601
  createdAt: string;
  updatedAt: string;
  deferredUntil?: string;
  ignoredReason?: string;
  maxHoldingDays?: number;
  positionSizePct?: number;      // % of account
  riskRewardRatio?: number;
  backtestSummary?: BacktestSummary;
}

// ─── PositionSnapshot ────────────────────────────────────────────────────────

export interface PositionLeg {
  asset: string;
  direction: Direction;
  size: number;
  unit: string;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  marginUsed: number;
}

export interface PositionGroup {
  id: string;
  strategyId?: string;
  strategyName?: string;
  recommendationId?: string;
  legs: PositionLeg[];
  openedAt: string;
  entrySpread: number;
  currentSpread: number;
  spreadUnit: string;
  unrealizedPnl: number;
  totalMarginUsed: number;
  exitCondition: string;   // human-readable
  targetZScore: number;    // exit when zScore drops below this
  currentZScore: number;
  halfLifeDays: number;
  daysHeld: number;
  status: "open" | "closed" | "partially_closed";
  closedAt?: string;
  realizedPnl?: number;
}

export interface AccountSnapshot {
  netValue: number;
  availableMargin: number;
  marginUtilizationRate: number; // 0–1
  totalUnrealizedPnl: number;
  todayRealizedPnl: number;
  snapshotAt: string;
}

export interface PositionSnapshot {
  id: string;
  account: AccountSnapshot;
  positions: PositionGroup[];
  updatedAt: string;
}

// ─── Research (demoted auxiliary) ────────────────────────────────────────────

export type ReportType = "daily" | "weekly" | "hypothesis" | "postmortem";

export interface ResearchHypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number;
  status: "new" | "validated" | "invalidated" | "monitoring";
  createdAt: string;
}

export interface ResearchReport {
  id: string;
  type: ReportType;
  title: string;
  summary: string;
  body: string;
  hypotheses: ResearchHypothesis[];
  relatedStrategyIds: string[];
  relatedAlertIds: string[];
  publishedAt: string;
}

// ─── Commodity Graph (auxiliary) ─────────────────────────────────────────────

export type CommodityCluster =
  | "ferrous"
  | "nonferrous"
  | "energy"
  | "agriculture"
  | "overseas";
export type NodeStatus = "normal" | "warning" | "alert" | "unknown";
export type RelationshipType =
  | "upstream_downstream"
  | "substitute"
  | "inventory_transfer"
  | "domestic_overseas"
  | "cost_driven";

export interface CommodityNode {
  id: string;
  name: string;
  symbol: string;
  cluster: CommodityCluster;
  exchange: string;
  status: NodeStatus;
  activeAlertCount: number;
  regime: string;
  priceChange24h?: number;
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: number; // 0–1
  label?: string;
  activeAlertCount: number;
}

// ─── Market Data Ingestion ────────────────────────────────────────────────────

export interface MarketDataPoint {
  market: string;        // "SHFE" | "DCE" | "INE" | "CZCE" | "CBOT" | "COMEX" | "NYMEX"
  exchange: string;
  commodity: string;     // 品种名
  symbol: string;        // 合约代码
  contractMonth: string; // 交割月
  timestamp: string;     // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  settle: number;        // 结算价
  volume: number;
  openInterest: number;
  currency: string;      // "CNY" | "USD"
  timezone: string;
}

export interface SpreadStatistics {
  symbol1: string;
  symbol2: string;
  window: number;
  spreadMean: number;       // residual mean (≈0 for cointegrated pairs)
  spreadStdDev: number;
  currentZScore: number;
  halfLife: number;      // days, simple EWM estimate
  adfPValue: number;     // simplified ADF test p-value
  sampleCount: number;
  hurstExponent?: number;
  hedgeRatio?: number;
  cointPValue?: number;
  rawSpreadMean?: number;   // raw price spread mean (leg1 - leg2)
  rawSpreadStdDev?: number; // raw price spread std dev
}
