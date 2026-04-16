import type {
  Hypothesis,
  SpreadHypothesis,
  DirectionalHypothesis,
  HypothesisLeg,
  DirectionalLeg,
  SpreadModel,
  AlertCategory,
} from "@/types/domain";

/**
 * Generate a unique hypothesis ID
 */
export function generateHypothesisId(): string {
  return `hyp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Factory: Create a SpreadHypothesis
 */
export function createSpreadHypothesis(params: {
  spreadModel: SpreadModel;
  legs: HypothesisLeg[];
  entryThreshold: number;
  exitThreshold: number;
  stopLossThreshold: number;
  currentZScore: number;
  halfLife: number;
  adfPValue: number;
  hypothesisText?: string;
  category?: AlertCategory;
  triggerDescription?: string;
  createdFromAlertId?: string;
  hurstExponent?: number;
  causalConfidence?: number;
  expectedSpread?: number;
  maxDrawdown?: number;
}): SpreadHypothesis {
  const now = new Date().toISOString();
  return {
    id: generateHypothesisId(),
    type: "spread",
    spreadModel: params.spreadModel,
    legs: params.legs,
    entryThreshold: params.entryThreshold,
    exitThreshold: params.exitThreshold,
    stopLossThreshold: params.stopLossThreshold,
    currentZScore: params.currentZScore,
    halfLife: params.halfLife,
    adfPValue: params.adfPValue,
    hurstExponent: params.hurstExponent,
    causalConfidence: params.causalConfidence,
    expectedSpread: params.expectedSpread,
    maxDrawdown: params.maxDrawdown,
    category: params.category,
    hypothesisText:
      params.hypothesisText ||
      `跨品种价差策略：做多${params.legs
        .filter((l) => l.direction === "long")
        .map((l) => l.asset)
        .join("、")}，做空${params.legs
        .filter((l) => l.direction === "short")
        .map((l) => l.asset)
        .join("、")}，预期均值回归`,
    triggerDescription: params.triggerDescription,
    createdFromAlertId: params.createdFromAlertId,
    createdAt: now,
    lastUpdated: now,
  };
}

/**
 * Factory: Create a DirectionalHypothesis
 */
export function createDirectionalHypothesis(params: {
  leg: DirectionalLeg;
  hypothesisText?: string;
  entryPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence?: number;
  riskRewardRatio?: number;
  positionSize?: number;
  category?: AlertCategory;
  momentum?: "up" | "down" | "neutral";
  triggerDescription?: string;
  createdFromAlertId?: string;
}): DirectionalHypothesis {
  const now = new Date().toISOString();
  return {
    id: generateHypothesisId(),
    type: "directional",
    leg: params.leg,
    hypothesisText:
      params.hypothesisText ||
      `方向性交易：${params.leg.direction === "long" ? "做多" : "做空"} ${params.leg.asset}`,
    entryPrice: params.entryPrice,
    currentPrice: params.currentPrice,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    confidence: params.confidence,
    riskRewardRatio: params.riskRewardRatio,
    positionSize: params.positionSize,
    category: params.category,
    momentum: params.momentum,
    triggerDescription: params.triggerDescription,
    createdFromAlertId: params.createdFromAlertId,
    createdAt: now,
    lastUpdated: now,
  };
}

/**
 * Type guard: check if a hypothesis is a spread hypothesis
 */
export function isSpreadHypothesis(h: Hypothesis): h is SpreadHypothesis {
  return h.type === "spread";
}

/**
 * Type guard: check if a hypothesis is a directional hypothesis
 */
export function isDirectionalHypothesis(h: Hypothesis): h is DirectionalHypothesis {
  return h.type === "directional";
}

/**
 * Get display label for a hypothesis
 */
export function getHypothesisLabel(h: Hypothesis): string {
  if (h.type === "spread") {
    const longs = h.legs.filter((l) => l.direction === "long").map((l) => l.asset);
    const shorts = h.legs.filter((l) => l.direction === "short").map((l) => l.asset);
    return `Spread: ${longs.join(",")} vs ${shorts.join(",")}`;
  }
  return `Directional: ${h.leg.direction === "long" ? "Long" : "Short"} ${h.leg.asset}`;
}
