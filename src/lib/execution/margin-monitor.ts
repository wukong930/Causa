/**
 * Real-time margin monitoring utilities.
 */

import type { AccountSnapshot, PositionGroup } from "@/types/domain";

export interface MarginAlert {
  level: "normal" | "warning" | "critical" | "liquidation";
  utilizationRate: number;
  message: string;
  suggestedAction?: string;
}

const THRESHOLDS = {
  warning: 0.5,
  critical: 0.7,
  liquidation: 0.85,
} as const;

export function checkMarginStatus(account: AccountSnapshot): MarginAlert {
  const rate = account.marginUtilizationRate;

  if (rate >= THRESHOLDS.liquidation) {
    return {
      level: "liquidation",
      utilizationRate: rate,
      message: `保证金占用率 ${(rate * 100).toFixed(1)}%，已接近强平线`,
      suggestedAction: "立即减仓或追加保证金",
    };
  }
  if (rate >= THRESHOLDS.critical) {
    return {
      level: "critical",
      utilizationRate: rate,
      message: `保证金占用率 ${(rate * 100).toFixed(1)}%，超过警戒线`,
      suggestedAction: "建议减少持仓或追加保证金",
    };
  }
  if (rate >= THRESHOLDS.warning) {
    return {
      level: "warning",
      utilizationRate: rate,
      message: `保证金占用率 ${(rate * 100).toFixed(1)}%，需关注`,
    };
  }
  return {
    level: "normal",
    utilizationRate: rate,
    message: `保证金占用率 ${(rate * 100).toFixed(1)}%，正常`,
  };
}

/**
 * Check if a new position can be opened given current margin state.
 */
export function canOpenPosition(
  account: AccountSnapshot,
  requiredMargin: number
): { allowed: boolean; reason?: string } {
  if (requiredMargin > account.availableMargin) {
    return {
      allowed: false,
      reason: `可用保证金不足：需要 ¥${requiredMargin.toLocaleString()}，可用 ¥${account.availableMargin.toLocaleString()}`,
    };
  }

  const newUtilization =
    (account.netValue - account.availableMargin + requiredMargin) / account.netValue;

  if (newUtilization >= THRESHOLDS.critical) {
    return {
      allowed: false,
      reason: `开仓后保证金占用率将达 ${(newUtilization * 100).toFixed(1)}%，超过 ${THRESHOLDS.critical * 100}% 警戒线`,
    };
  }

  return { allowed: true };
}
