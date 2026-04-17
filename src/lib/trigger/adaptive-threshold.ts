/**
 * Adaptive threshold engine — replaces hardcoded trigger thresholds
 * with regime-aware, category-specific dynamic values.
 *
 * High vol regime → widen entry thresholds (avoid noise)
 * Low vol regime → tighten entry thresholds (capture smaller moves)
 * Short half-life → tighter entry, wider exit (fast reversion)
 */
import type { AlertCategory } from "@/types/domain";

export interface ThresholdProfile {
  /** Z-score to enter a spread trade (default 2.0) */
  zScoreEntry: number;
  /** Z-score to exit (default 0.5) */
  zScoreExit: number;
  /** Volume spike % to confirm momentum (default 30) */
  volumeSpike: number;
  /** Basis deviation in σ to trigger (default 1.5) */
  basisDeviation: number;
  /** Hurst shift magnitude to detect regime change (default 0.15) */
  hurstShift: number;
  /** Correlation break delta threshold (default 0.3) */
  corrBreak: number;
  /** Minimum confidence to emit alert (default 0.6) */
  minConfidence: number;
  /** Half-life cap in days for "fast reversion" (default 30) */
  halfLifeCap: number;
}

const BASE: ThresholdProfile = {
  zScoreEntry: 2.0,
  zScoreExit: 0.5,
  volumeSpike: 30,
  basisDeviation: 1.5,
  hurstShift: 0.15,
  corrBreak: 0.3,
  minConfidence: 0.6,
  halfLifeCap: 30,
};

/** Category-specific base adjustments */
const CATEGORY_ADJUSTMENTS: Partial<Record<AlertCategory, Partial<ThresholdProfile>>> = {
  ferrous: {
    // 黑色系波动大，放宽入场阈值
    zScoreEntry: 2.2,
    basisDeviation: 1.7,
    volumeSpike: 25,
  },
  nonferrous: {
    // 有色系相对稳定
    zScoreEntry: 1.9,
    basisDeviation: 1.4,
  },
  energy: {
    // 能源波动大，受地缘政治影响
    zScoreEntry: 2.3,
    basisDeviation: 1.8,
    corrBreak: 0.35,
  },
  agriculture: {
    // 农产品季节性强
    zScoreEntry: 2.0,
    basisDeviation: 1.5,
    halfLifeCap: 25,
  },
};

/** Regime multipliers applied on top of category base */
const REGIME_MULTIPLIERS: Record<"high" | "low" | "normal", Partial<ThresholdProfile>> = {
  high: {
    // 高波动：放宽入场（避免噪音），收紧成交量确认
    zScoreEntry: 1.25,   // ×1.25 → 2.0 becomes 2.5
    zScoreExit: 0.8,     // ×0.8 → faster exit
    volumeSpike: 0.75,   // ×0.75 → lower bar (vol already high)
    basisDeviation: 1.2,
    corrBreak: 1.15,
    minConfidence: 1.1,
  },
  low: {
    // 低波动：收紧入场（捕捉小幅偏离）
    zScoreEntry: 0.9,    // ×0.9 → 2.0 becomes 1.8
    zScoreExit: 1.2,
    volumeSpike: 1.2,    // ×1.2 → higher bar (vol is low, need real spike)
    basisDeviation: 0.9,
    corrBreak: 0.85,
    minConfidence: 0.9,
  },
  normal: {
    zScoreEntry: 1.0,
    zScoreExit: 1.0,
    volumeSpike: 1.0,
    basisDeviation: 1.0,
    corrBreak: 1.0,
    minConfidence: 1.0,
  },
};

/**
 * Get adaptive thresholds based on category, volatility regime, and half-life.
 */
export function getAdaptiveThresholds(
  category: AlertCategory,
  volRegime: "high" | "low" | "normal" = "normal",
  halfLife?: number
): ThresholdProfile {
  // Start with base
  const catAdj = CATEGORY_ADJUSTMENTS[category] ?? {};
  const profile: ThresholdProfile = { ...BASE, ...catAdj };

  // Apply regime multipliers
  const regime = REGIME_MULTIPLIERS[volRegime];
  profile.zScoreEntry *= regime.zScoreEntry ?? 1;
  profile.zScoreExit *= regime.zScoreExit ?? 1;
  profile.volumeSpike *= regime.volumeSpike ?? 1;
  profile.basisDeviation *= regime.basisDeviation ?? 1;
  profile.corrBreak *= regime.corrBreak ?? 1;
  profile.minConfidence *= regime.minConfidence ?? 1;

  // Half-life adjustment: short half-life → tighter entry, wider exit
  if (halfLife !== undefined && halfLife > 0 && halfLife < Infinity) {
    if (halfLife <= 5) {
      profile.zScoreEntry *= 0.9;  // easier to enter (fast reversion)
      profile.zScoreExit *= 1.3;   // wider exit (let it run)
    } else if (halfLife > 20) {
      profile.zScoreEntry *= 1.15; // harder to enter (slow reversion)
      profile.zScoreExit *= 0.8;   // tighter exit (cut early)
    }
  }

  // Clamp to reasonable ranges
  profile.zScoreEntry = clamp(profile.zScoreEntry, 1.5, 3.5);
  profile.zScoreExit = clamp(profile.zScoreExit, 0.2, 1.0);
  profile.volumeSpike = clamp(profile.volumeSpike, 15, 60);
  profile.basisDeviation = clamp(profile.basisDeviation, 1.0, 2.5);
  profile.hurstShift = clamp(profile.hurstShift, 0.08, 0.25);
  profile.corrBreak = clamp(profile.corrBreak, 0.15, 0.5);
  profile.minConfidence = clamp(profile.minConfidence, 0.4, 0.8);

  return profile;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
