// ─── Alert ─────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertCategory = "ferrous" | "nonferrous" | "energy" | "agriculture" | "overseas";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "expired";
export type AlertType =
  | "spread_deviation"
  | "event_impact"
  | "inventory_shock"
  | "price_dislocation"
  | "basis_abnormal"
  | "regime_shift";

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
  confidence: number; // 0–1
  relatedAssets: string[];
  spreadInfo?: SpreadInfo;
  triggerChain: TriggerStep[];
  suggestion?: string;
  invalidationCondition: string;
  historicalSimilarIds?: string[];
  riskItems: string[];
  manualCheckItems: string[];
}

export interface SpreadInfo {
  leg1: string;
  leg2: string;
  currentSpread: number;
  historicalMean: number;
  zScore: number;
  unit: string;
}

export interface TriggerStep {
  step: number;
  description: string;
  evidence?: string;
}

// ─── Setup (Candidate Strategy) ────────────────────────────────────────────

export type SetupFamily =
  | "calendar_spread"
  | "cross_commodity"
  | "basis_trade"
  | "inter_market"
  | "event_driven"
  | "structural";

export type SetupStatus =
  | "watching"
  | "approaching_trigger"
  | "triggered"
  | "invalid"
  | "completed";

export interface Setup {
  id: string;
  name: string;
  family: SetupFamily;
  hypothesisType: string;
  assets: string[];
  status: SetupStatus;
  confidence: number; // 0–1
  tradability: number; // 0–1
  description: string;
  entryCondition: string;
  exitCondition: string;
  invalidationCondition: string;
  riskItems: string[];
  relatedAlertIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Suggestion (Semi-auto trade) ──────────────────────────────────────────

export type SuggestionStatus = "pending" | "confirmed" | "deferred" | "dismissed";

export interface Suggestion {
  id: string;
  setupId: string;
  alertId?: string;
  expression: string; // e.g. "Long RB2505 / Short HC2505"
  leg1: SuggestionLeg;
  leg2?: SuggestionLeg;
  confidence: number;
  liquidityScore: number; // 0–1
  executionWindow: string;
  keyRisks: string[];
  confirmationChecklist: string[];
  status: SuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionLeg {
  asset: string;
  contract: string;
  direction: "long" | "short";
  targetSize?: number;
  unit?: string;
}

// ─── Research ───────────────────────────────────────────────────────────────

export type ReportType = "daily" | "weekly" | "hypothesis" | "postmortem";

export interface ResearchReport {
  id: string;
  type: ReportType;
  title: string;
  summary: string;
  body: string;
  hypotheses: Hypothesis[];
  relatedSetupIds: string[];
  relatedAlertIds: string[];
  publishedAt: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number;
  status: "new" | "validated" | "invalidated" | "monitoring";
  createdAt: string;
}

// ─── Commodity Graph ────────────────────────────────────────────────────────

export type CommodityCluster = "ferrous" | "nonferrous" | "energy" | "agriculture" | "overseas";
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
  source: string; // node id
  target: string; // node id
  type: RelationshipType;
  strength: number; // 0–1
  label?: string;
  activeAlertCount: number;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export interface WatchItem {
  id: string;
  type: "commodity" | "spread" | "event_type";
  label: string;
  description?: string;
  addedAt: string;
}
