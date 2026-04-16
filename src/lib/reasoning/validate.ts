import type { Hypothesis, SpreadHypothesis, MarketDataPoint } from "@/types/domain";
import { getHypothesisHistory } from "@/lib/memory/hypothesis-store";

/**
 * Validation matrix scoring per v3.0 architecture (upgraded):
 * Score = 0.20*Stability + 0.20*IC + 0.15*Robustness + 0.15*Regime + 0.10*Cost + 0.10*TailRisk + 0.10*MemoryFeedback
 */

export interface ValidationResult {
  hypothesisId: string;
  totalScore: number;
  stability: number;
  ic: number;
  robustness: number;
  regimeConsistency: number;
  cost: number;
  tailRisk: number;
  memoryFeedback: number;
  details: string;
}

const WEIGHTS = {
  stability: 0.20,
  ic: 0.20,
  robustness: 0.15,
  regimeConsistency: 0.15,
  cost: 0.10,
  tailRisk: 0.10,
  memoryFeedback: 0.10,
};

/**
 * Validate a hypothesis using statistical checks + memory feedback.
 * Returns a score 0-100 based on the validation matrix.
 */
export async function validateHypothesis(
  hypothesis: Hypothesis,
  marketData?: MarketDataPoint[]
): Promise<ValidationResult> {
  let stability = 50;
  let ic = 50;
  let robustness = 50;
  let regimeConsistency = 50;
  let cost = 50;
  let tailRisk = 50;
  let memoryFeedback = 50;

  if (hypothesis.type === "spread") {
    const sh = hypothesis as SpreadHypothesis;

    // Stability: based on ADF p-value (lower = more stable cointegration)
    if (sh.adfPValue < 0.01) stability = 95;
    else if (sh.adfPValue < 0.05) stability = 80;
    else if (sh.adfPValue < 0.10) stability = 60;
    else stability = 30;

    // IC: based on half-life (shorter = more predictable mean reversion)
    if (sh.halfLife > 0 && sh.halfLife <= 5) ic = 90;
    else if (sh.halfLife <= 10) ic = 75;
    else if (sh.halfLife <= 20) ic = 55;
    else ic = 30;

    // Robustness: based on z-score magnitude (higher = stronger signal)
    const absZ = Math.abs(sh.currentZScore);
    if (absZ >= 3.0) robustness = 90;
    else if (absZ >= 2.5) robustness = 75;
    else if (absZ >= 2.0) robustness = 60;
    else robustness = 35;

    // Regime consistency: based on Hurst exponent if available
    if (sh.hurstExponent !== undefined) {
      if (sh.hurstExponent < 0.4) regimeConsistency = 85; // mean-reverting
      else if (sh.hurstExponent < 0.5) regimeConsistency = 70;
      else regimeConsistency = 40; // trending, bad for spread
    }

    // Cost: estimate from spread std dev vs transaction cost
    // Round-trip cost ≈ 0.1% of avg price; expected profit ≈ |z| × spreadStdDev
    if (sh.currentZScore !== 0 && marketData && marketData.length > 0) {
      const avgPrice = marketData.reduce((s, d) => s + d.close, 0) / marketData.length;
      const tickCost = avgPrice * 0.001; // ~0.1% round-trip estimate
      // Expected profit: z-score × estimated spread std dev
      // Derive spread std from expectedSpread if available, else use 1% of avg price
      const spreadStd = sh.expectedSpread
        ? Math.abs(sh.expectedSpread) / Math.max(1, Math.abs(sh.currentZScore))
        : avgPrice * 0.01;
      const expectedProfit = Math.abs(sh.currentZScore) * spreadStd;
      const costRatio = expectedProfit > 0 ? tickCost / expectedProfit : 1;
      if (costRatio < 0.05) cost = 90;
      else if (costRatio < 0.10) cost = 75;
      else if (costRatio < 0.20) cost = 55;
      else cost = 30;
    }

    // Tail risk: based on max drawdown if available
    if (sh.maxDrawdown !== undefined) {
      if (sh.maxDrawdown < 5000) tailRisk = 85;
      else if (sh.maxDrawdown < 15000) tailRisk = 65;
      else if (sh.maxDrawdown < 30000) tailRisk = 45;
      else tailRisk = 25;
    }

    // Memory feedback: query historical outcomes for similar hypotheses
    memoryFeedback = await getMemoryFeedbackScore(sh);
  } else {
    // Directional hypothesis: simpler validation
    const dh = hypothesis;
    if (dh.confidence !== undefined) {
      stability = Math.round(dh.confidence * 100);
      ic = Math.round(dh.confidence * 80);
    }
    if (dh.riskRewardRatio !== undefined) {
      robustness = Math.min(100, Math.round(dh.riskRewardRatio * 30));
    }
  }

  const totalScore =
    WEIGHTS.stability * stability +
    WEIGHTS.ic * ic +
    WEIGHTS.robustness * robustness +
    WEIGHTS.regimeConsistency * regimeConsistency +
    WEIGHTS.cost * cost +
    WEIGHTS.tailRisk * tailRisk +
    WEIGHTS.memoryFeedback * memoryFeedback;

  const details = [
    `稳定性: ${stability}`,
    `IC: ${ic}`,
    `鲁棒性: ${robustness}`,
    `体制一致性: ${regimeConsistency}`,
    `成本: ${cost}`,
    `尾部风险: ${tailRisk}`,
    `记忆反馈: ${memoryFeedback}`,
  ].join(" | ");

  return {
    hypothesisId: hypothesis.id,
    totalScore: Math.round(totalScore * 10) / 10,
    stability,
    ic,
    robustness,
    regimeConsistency,
    cost,
    tailRisk,
    memoryFeedback,
    details,
  };
}

/**
 * Query Weaviate for historical hypothesis outcomes and compute a feedback score.
 * Uses strategy-level history when available.
 * Win rate > 0.6 → boost; < 0.4 → penalize.
 */
async function getMemoryFeedbackScore(sh: SpreadHypothesis): Promise<number> {
  try {
    // If we have a linked strategy, query its history
    const strategyId = (sh as unknown as Record<string, string>).strategyId;
    if (!strategyId) return 50;

    const records = await getHypothesisHistory(strategyId, 20);

    // Filter to resolved outcomes only
    const resolved = records.filter(
      (r) => r.outcome === "profitable" || r.outcome === "loss"
    );

    if (resolved.length < 3) return 50; // insufficient data, neutral

    const wins = resolved.filter((r) => r.outcome === "profitable").length;
    const winRate = wins / resolved.length;

    if (winRate > 0.7) return 85;
    if (winRate > 0.6) return 70;
    if (winRate > 0.4) return 50;
    if (winRate > 0.3) return 35;
    return 20;
  } catch {
    return 50; // Weaviate unavailable, neutral
  }
}
