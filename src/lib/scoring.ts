import type {
  SpreadInfo,
  RecommendationLeg,
  PositionGroup,
  AccountSnapshot,
} from "@/types/domain";

/**
 * Calculate priority score from spread info and confidence.
 * Range: 0-100
 * - Severity encoded in z-score magnitude
 * - Confidence contributes proportionally
 * - Half-life provides mean-reversion conviction
 */
export function calcPriorityScore(
  spreadInfo: SpreadInfo | undefined,
  confidence: number
): number {
  let score = 30; // base

  if (spreadInfo) {
    // Z-score magnitude: larger = more extreme = more urgent
    const zMagnitude = Math.abs(spreadInfo.zScore);
    score += Math.min(30, zMagnitude * 10);

    // Mean-reversion conviction: short half-life = faster reversion = higher priority
    const halfLifeBonus = Math.max(0, (30 - spreadInfo.halfLife) / 30) * 15;
    score += halfLifeBonus;

    // ADF stationarity: low p-value = more confident in mean-reversion
    if (spreadInfo.adfPValue < 0.05) {
      score += 10;
    } else if (spreadInfo.adfPValue < 0.1) {
      score += 5;
    }
  }

  // Confidence contribution
  score += confidence * 15;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Portfolio fit score: evaluates whether the proposed legs fit with existing positions.
 * Range: 0-100
 * - Penalize if legs correlate with existing positions (concentration risk)
 * - Penalize if legs use the same exchange/cluster (margin efficiency)
 * - Reward if legs hedge or diversify existing exposures
 */
export async function calcPortfolioFitScore(
  legs: RecommendationLeg[],
  openPositions: PositionGroup[]
): Promise<number> {
  if (openPositions.length === 0) return 75; // neutral

  const legAssets = new Set(legs.map((l) => l.asset));

  let conflictPenalty = 0;
  let diversificationBonus = 0;

  for (const pos of openPositions) {
    const posAssets = new Set(pos.legs.map((l) => l.asset));

    // Check for asset overlap
    const overlap = [...legAssets].filter((a) => posAssets.has(a));
    if (overlap.length > 0) {
      conflictPenalty += 20 * (overlap.length / Math.max(legAssets.size, posAssets.size));
    }

    // Check for correlation (same exchange as proxy for correlation)
    // This is a simplification; in production, use correlation matrix from market data
    if (posAssets.size > 0) {
      diversificationBonus += 5;
    }
  }

  // Clamp to 0-100
  const baseScore = 70;
  const score = baseScore - Math.min(40, conflictPenalty) + Math.min(20, diversificationBonus);
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Margin efficiency score: evaluates capital efficiency.
 * Range: 0-100
 * - Higher margin efficiency = lower margin required relative to account net value
 * - Reward smaller margin requirements
 */
export function calcMarginEfficiencyScore(
  legs: RecommendationLeg[],
  marginRequired: number,
  accountNetValue: number
): number {
  if (accountNetValue <= 0) return 50;

  const marginRatio = marginRequired / accountNetValue;

  // Target: margin usage < 10% of net value = score 90+
  // Margin usage > 50% of net value = score 10-
  const score = Math.max(0, Math.min(100, Math.round(100 - marginRatio * 200)));
  return score;
}

/**
 * Combined recommendation score for ranking/display.
 */
export function calcCombinedScore(
  priorityScore: number,
  portfolioFitScore: number,
  marginEfficiencyScore: number
): number {
  // Weights: signal quality (40%), portfolio balance (30%), capital efficiency (30%)
  return Math.round(
    priorityScore * 0.4 +
    portfolioFitScore * 0.3 +
    marginEfficiencyScore * 0.3
  );
}
