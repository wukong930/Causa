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
  | "acknowledged"
  | "escalated"
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
  // lifecycle linkage
  relatedStrategyId?: string;
  relatedRecommendationId?: string;
  relatedResearchId?: string;
  invalidationReason?: string;
}

// ─── SpreadHypothesis ────────────────────────────────────────────────────────

export interface HypothesisLeg {
  asset: string;       // e.g. "RB2501"
  direction: Direction;
  ratio: number;       // position sizing ratio, e.g. 1
  exchange: string;    // e.g. "SHFE"
}

export interface SpreadHypothesis {
  id: string;
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
  lastUpdated: string;
}

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
  | "pending"
  | "confirmed"
  | "deferred"
  | "ignored"
  | "backfilled"
  | "expired";

export interface RecommendationLeg {
  asset: string;
  direction: Direction;
  suggestedSize: number;
  unit: string;
  entryPriceRef?: number;
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
  riskItems: string[];
  expiresAt: string;             // ISO 8601
  createdAt: string;
  updatedAt: string;
  deferredUntil?: string;
  ignoredReason?: string;
  executionFeedbackId?: string;
}

// ─── ExecutionFeedback ───────────────────────────────────────────────────────

export type FeedbackLegType = "open" | "close" | "reduce" | "add";

export interface ExecutionFeedbackLeg {
  asset: string;
  direction: Direction;
  type: FeedbackLegType;
  filledSize: number;
  filledPrice: number;
  filledAt: string; // ISO 8601
  unit: string;
  commission: number;
}

export interface ExecutionFeedback {
  id: string;
  recommendationId?: string;
  strategyId?: string;
  legs: ExecutionFeedbackLeg[];
  totalMarginUsed: number;
  totalCommission: number;
  slippageNote?: string;
  liquidityNote?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

// ─── Suggestion (legacy) ───────────────────────────────────────────────────────

export type SuggestionStatus = "pending" | "confirmed" | "deferred" | "dismissed";

export interface SuggestionLeg {
  asset: string;
  contract: string;
  direction: "long" | "short";
  targetSize?: number;
  unit?: string;
}

export interface Suggestion {
  id: string;
  setupId: string;
  alertId?: string;
  expression: string;
  leg1: SuggestionLeg;
  leg2?: SuggestionLeg;
  confidence: number;
  liquidityScore: number;
  executionWindow: string;
  keyRisks: string[];
  confirmationChecklist: string[];
  status: SuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Research (demoted auxiliary) ────────────────────────────────────────────

export type ReportType = "daily" | "weekly" | "hypothesis" | "postmortem";

export interface Hypothesis {
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
  hypotheses: Hypothesis[];
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
