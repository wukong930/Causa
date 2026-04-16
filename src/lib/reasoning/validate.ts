import type { Hypothesis, SpreadHypothesis, MarketDataPoint } from "@/types/domain";

/**
 * Validation matrix scoring per v3.0 architecture:
 * Score = 0.25*Stability + 0.20*IC + 0.20*Robustness + 0.15*Regime + 0.10*Cost + 0.10*TailRisk
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
  details: string;
}

const WEIGHTS = {
  stability: 0.25,
  ic: 0.20,
  robustness: 0.20,
  regimeConsistency: 0.15,
  cost: 0.10,
  tailRisk: 0.10,
};

/**
 * Validate a hypothesis using statistical checks.
 * Returns a score 0-100 based on the validation matrix.
 */
export function validateHypothesis(
  hypothesis: Hypothesis,
  marketData?: MarketDataPoint[]
): ValidationResult {
  let stability = 50;
  let ic = 50;
  let robustness = 50;
  let regimeConsistency = 50;
  let cost = 70;
  let tailRisk = 50;

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

    // Cost: based on cost-spread ratio from validation metrics
    // Lower cost-spread ratio = better
    cost = 70; // default, will be refined with backtest data

    // Tail risk: based on max drawdown if available
    if (sh.maxDrawdown !== undefined) {
      if (sh.maxDrawdown < 5000) tailRisk = 85;
      else if (sh.maxDrawdown < 15000) tailRisk = 65;
      else if (sh.maxDrawdown < 30000) tailRisk = 45;
      else tailRisk = 25;
    }
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
    WEIGHTS.tailRisk * tailRisk;

  const details = [
    `稳定性: ${stability}`,
    `IC: ${ic}`,
    `鲁棒性: ${robustness}`,
    `体制一致性: ${regimeConsistency}`,
    `成本: ${cost}`,
    `尾部风险: ${tailRisk}`,
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
    details,
  };
}
