/**
 * Conviction Scoring — multi-dimensional evidence aggregation.
 *
 * Replaces single-dimension confidence with conviction based on
 * how many independent factor models agree on direction.
 *
 * conviction = |Σ(direction × strength × effectiveWeight)| / Σ(effectiveWeight)
 * effectiveWeight = configWeight × dataQuality
 */

import type { FactorResult, FactorDirection, ConvictionScore } from "@/types/domain";
import type { FactorWeight } from "./configs/types";
import { fuseTimeframes } from "./timeframe";

export function computeConviction(
  factors: FactorResult[],
  weights: Record<string, FactorWeight>,
): ConvictionScore {
  let weightedSum = 0;
  let totalWeight = 0;
  const supporting: FactorResult[] = [];
  const opposing: FactorResult[] = [];
  const dataGaps: string[] = [];

  for (const factor of factors) {
    const config = weights[factor.name];
    if (!config) continue;

    if (factor.dataQuality === 0) {
      dataGaps.push(factor.description);
      continue;
    }

    const effectiveWeight = config.weight * factor.dataQuality;
    weightedSum += factor.direction * factor.strength * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  if (totalWeight === 0) {
    return {
      overallDirection: 0,
      score: 0,
      supportingFactors: [],
      opposingFactors: [],
      dataGaps,
    };
  }

  const rawScore = weightedSum / totalWeight;  // range [-1, 1]
  const overallDirection: FactorDirection = rawScore > 0.05 ? 1 : rawScore < -0.05 ? -1 : 0;

  // Apply multi-timeframe alignment multiplier
  const { alignmentMultiplier } = fuseTimeframes(factors);
  const score = Math.min(1, Math.abs(rawScore) * alignmentMultiplier);  // 0-1

  // Partition factors into supporting/opposing based on overall direction
  for (const factor of factors) {
    if (factor.dataQuality === 0) continue;
    if (factor.direction === 0) continue;

    if (factor.direction === overallDirection) {
      supporting.push(factor);
    } else {
      opposing.push(factor);
    }
  }

  // Sort by strength descending
  supporting.sort((a, b) => b.strength - a.strength);
  opposing.sort((a, b) => b.strength - a.strength);

  return {
    overallDirection,
    score,
    supportingFactors: supporting,
    opposingFactors: opposing,
    dataGaps,
  };
}
