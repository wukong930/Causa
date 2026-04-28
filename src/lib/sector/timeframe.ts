/**
 * Multi-Timeframe Fusion — hierarchical Bayesian-style weighting.
 *
 * Factors are grouped by timeframe:
 *   monthly (0.40) — macro direction (USDA, PMI, CFTC)
 *   weekly  (0.35) — supply/demand (inventory, warehouse receipts, basis)
 *   daily   (0.25) — execution timing (cost, margin, substitute)
 *
 * Alignment multiplier:
 *   All same direction → ×1.2 (resonance)
 *   Mixed              → ×0.8
 *   Monthly vs daily contradiction → ×0.6 (higher timeframe wins)
 */

import type { FactorResult, FactorDirection, Timeframe } from "@/types/domain";

/** Default timeframe weights */
const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  monthly: 0.40,
  weekly: 0.35,
  daily: 0.25,
};

interface TimeframeBucket {
  timeframe: Timeframe;
  factors: FactorResult[];
  netDirection: FactorDirection;
  avgStrength: number;
}

export interface TimeframeFusionResult {
  /** Alignment multiplier to apply to conviction score */
  alignmentMultiplier: number;
  /** Per-timeframe summaries */
  buckets: TimeframeBucket[];
  /** Human-readable alignment description */
  alignmentLabel: string;
}

/**
 * Group factors by timeframe, compute per-bucket direction,
 * then determine cross-timeframe alignment.
 */
export function fuseTimeframes(factors: FactorResult[]): TimeframeFusionResult {
  const groups: Record<Timeframe, FactorResult[]> = {
    monthly: [],
    weekly: [],
    daily: [],
  };

  for (const f of factors) {
    if (f.dataQuality === 0) continue;
    groups[f.timeframe].push(f);
  }

  const buckets: TimeframeBucket[] = (["monthly", "weekly", "daily"] as Timeframe[]).map(
    (tf) => {
      const bucket = groups[tf];
      if (bucket.length === 0) {
        return { timeframe: tf, factors: bucket, netDirection: 0 as FactorDirection, avgStrength: 0 };
      }

      let weightedDir = 0;
      let totalStrength = 0;
      for (const f of bucket) {
        weightedDir += f.direction * f.strength;
        totalStrength += f.strength;
      }

      const avg = totalStrength > 0 ? weightedDir / totalStrength : 0;
      const netDirection: FactorDirection = avg > 0.05 ? 1 : avg < -0.05 ? -1 : 0;
      const avgStrength = totalStrength / bucket.length;

      return { timeframe: tf, factors: bucket, netDirection, avgStrength };
    }
  );

  // Determine alignment
  const activeBuckets = buckets.filter((b) => b.factors.length > 0 && b.netDirection !== 0);

  if (activeBuckets.length <= 1) {
    return { alignmentMultiplier: 1.0, buckets, alignmentLabel: "单一时间尺度" };
  }

  const directions = activeBuckets.map((b) => b.netDirection);
  const allSame = directions.every((d) => d === directions[0]);

  if (allSame) {
    return { alignmentMultiplier: 1.2, buckets, alignmentLabel: "多周期共振" };
  }

  // Check monthly vs daily contradiction specifically
  const monthlyBucket = buckets.find((b) => b.timeframe === "monthly" && b.netDirection !== 0);
  const dailyBucket = buckets.find((b) => b.timeframe === "daily" && b.netDirection !== 0);

  if (monthlyBucket && dailyBucket && monthlyBucket.netDirection !== dailyBucket.netDirection) {
    return { alignmentMultiplier: 0.6, buckets, alignmentLabel: "月度与日度矛盾" };
  }

  return { alignmentMultiplier: 0.8, buckets, alignmentLabel: "混合信号" };
}

/**
 * Apply timeframe-weighted scoring to factors.
 * Returns adjusted (direction × strength × timeframeWeight) contributions.
 */
export function timeframeWeightedScore(factors: FactorResult[]): {
  weightedSum: number;
  totalWeight: number;
} {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const f of factors) {
    if (f.dataQuality === 0) continue;
    const tfWeight = TIMEFRAME_WEIGHTS[f.timeframe];
    const contribution = f.direction * f.strength * f.dataQuality * tfWeight;
    weightedSum += contribution;
    totalWeight += f.dataQuality * tfWeight;
  }

  return { weightedSum, totalWeight };
}
