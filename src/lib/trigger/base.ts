import type {
  AlertType,
  AlertSeverity,
  AlertCategory,
  MarketDataPoint,
  SpreadStatistics,
  SpreadInfo,
  TriggerStep,
  PositionGroup,
  AccountSnapshot,
} from "@/types/domain";

export type { SpreadStatistics } from "@/types/domain";

/**
 * Risk parameters for position-aware filtering
 */
export interface RiskParameters {
  maxPositionSizePerCommodity: number;  // max lots per commodity, default 10
  maxMarginUtilization: number;        // max margin utilization ratio, default 0.80
  maxConcentrationPerCategory: number; // max margin % per category, default 0.40
}

/**
 * Context passed to trigger evaluators
 */
export interface TriggerContext {
  symbol1: string;
  symbol2?: string;
  category: AlertCategory;
  marketData: MarketDataPoint[];
  spreadStats?: SpreadStatistics;
  /** Open positions for conflict/concentration checks */
  positions?: PositionGroup[];
  /** Latest account snapshot for margin checks */
  accountSnapshot?: AccountSnapshot;
  /** Risk thresholds; defaults applied when omitted */
  riskParams?: RiskParameters;
  timestamp: string;
}

/**
 * Result returned by trigger evaluators
 */
export interface TriggerResult {
  triggered: boolean;
  severity: AlertSeverity;
  confidence: number; // 0-1
  triggerChain: TriggerStep[];
  spreadInfo?: SpreadInfo;
  relatedAssets: string[];
  riskItems: string[];
  manualCheckItems: string[];
  title: string;
  summary: string;
}

/**
 * Base interface for all trigger evaluators
 */
export interface TriggerEvaluator {
  type: AlertType;
  evaluate(context: TriggerContext): Promise<TriggerResult | null>;
}

/**
 * Helper to build trigger steps
 */
export function buildTriggerStep(
  step: number,
  label: string,
  description: string,
  confidence: number
): TriggerStep {
  return {
    step,
    label,
    description,
    timestamp: new Date().toISOString(),
    confidence,
  };
}

/**
 * Helper to determine severity from z-score
 */
export function severityFromZScore(zScore: number): AlertSeverity {
  const absZ = Math.abs(zScore);
  if (absZ > 3.0) return "critical";
  if (absZ > 2.5) return "high";
  if (absZ > 2.0) return "medium";
  return "low";
}

/**
 * Helper to calculate moving average
 */
export function calculateMA(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  return result;
}

/**
 * Helper to calculate volume change percentage
 */
export function calculateVolumeChange(
  current: number,
  previous: number
): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
