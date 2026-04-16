import type { PositionGroup, AccountSnapshot } from "@/types/domain";

// ─── Portfolio Risk Metrics ──────────────────────────────────────────────────

export interface PortfolioRiskMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  leverageRatio: number;
  concentrationRisk: Record<string, number>;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  winRate: number;
  avgHoldingDays: number;
}

/**
 * Calculate portfolio-level risk metrics from open and closed positions.
 * Sharpe ratio is estimated from unrealized PnL variance (simplified).
 * Max drawdown is estimated from worst closed position.
 */
export function calculatePortfolioRisk(
  openPositions: PositionGroup[],
  account: AccountSnapshot,
  closedPositions?: PositionGroup[]
): PortfolioRiskMetrics {
  const totalUnrealized = openPositions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0
  );

  // Estimate realized from closed positions
  const totalRealized = closedPositions
    ? closedPositions.reduce((sum, p) => sum + (p.realizedPnl ?? 0), 0)
    : 0;

  // Leverage: total margin used / net value
  const totalMarginUsed = openPositions.reduce(
    (sum, p) => sum + p.totalMarginUsed,
    0
  );
  const leverageRatio = account.netValue > 0 ? totalMarginUsed / account.netValue : 0;

  // Concentration: group margin usage by category (inferred from strategy name keywords)
  const concentrationRisk: Record<string, number> = {};
  for (const pos of openPositions) {
    const cat = inferCategory(pos.strategyName ?? "");
    concentrationRisk[cat] = (concentrationRisk[cat] ?? 0) + pos.totalMarginUsed;
  }

  // Win rate from closed positions
  const winRate = closedPositions && closedPositions.length > 0
    ? closedPositions.filter((p) => (p.realizedPnl ?? 0) > 0).length / closedPositions.length
    : 0;

  // Avg holding days (open positions)
  const avgHoldingDays = openPositions.length > 0
    ? openPositions.reduce((sum, p) => sum + p.daysHeld, 0) / openPositions.length
    : 0;

  // Sharpe: simplified — use daily realized PnL series (or just return 0 if insufficient data)
  // Since we don't have a time series, return a placeholder derived from account metrics
  const sharpeRatio = estimateSharpe(account);

  // Max drawdown: worst closed position loss
  const maxDrawdown = closedPositions && closedPositions.length > 0
    ? Math.min(...closedPositions.map((p) => p.realizedPnl ?? 0))
    : 0;

  return {
    sharpeRatio,
    maxDrawdown,
    leverageRatio,
    concentrationRisk,
    totalUnrealizedPnl: totalUnrealized,
    totalRealizedPnl: totalRealized,
    winRate,
    avgHoldingDays,
  };
}

// ─── Position Health Score ──────────────────────────────────────────────────

export interface PositionHealthScore {
  roi: number;
  marginEfficiency: number;
  daysToHalfLifeRatio: number;
  zScoreDistanceToExit: number;
  healthScore: number;
  status: "healthy" | "warning" | "critical";
}

/**
 * Compute a 0–100 health score for a single open position.
 * Higher = closer to a good exit. Lower = more concerning.
 */
export function calculatePositionHealth(pos: PositionGroup): PositionHealthScore {
  // ROI: unrealized PnL relative to margin used
  const roi = pos.totalMarginUsed > 0 ? pos.unrealizedPnl / pos.totalMarginUsed : 0;

  // Margin efficiency (same as ROI here)
  const marginEfficiency = roi;

  // Days elapsed vs half-life
  const daysToHalfLifeRatio = pos.halfLifeDays > 0 ? pos.daysHeld / pos.halfLifeDays : 0;

  // Z-score distance to target (how close are we to exit?)
  const zScoreDistanceToExit = Math.abs(pos.currentZScore - pos.targetZScore);

  // Health score components (each 0–100)
  const roiScore = Math.max(0, Math.min(100, (roi + 1) * 50)); // -100% → 0, 0% → 50, +100% → 100
  const timeScore = Math.max(0, Math.min(100, (1 - daysToHalfLifeRatio) * 100)); // 0 half-lives → 100, 1+ → 0
  const zScoreScore = Math.max(0, Math.min(100, (1 - zScoreDistanceToExit / 3) * 100)); // distance 0 → 100, distance 3+ → 0

  const healthScore = Math.round(roiScore * 0.4 + timeScore * 0.3 + zScoreScore * 0.3);

  let status: PositionHealthScore["status"];
  if (healthScore >= 60) {
    status = "healthy";
  } else if (healthScore >= 35) {
    status = "warning";
  } else {
    status = "critical";
  }

  return {
    roi,
    marginEfficiency,
    daysToHalfLifeRatio,
    zScoreDistanceToExit,
    healthScore,
    status,
  };
}

// ─── Exit Signal Detection ─────────────────────────────────────────────────

export interface ExitSignal {
  positionId: string;
  signalType: "approaching_exit" | "in_profit" | "breakeven" | "at_loss";
  daysToExit: number;
  confidence: number;
  reason: string;
}

/**
 * Detect exit signals across open positions.
 * Signal types: approaching_exit (Z-score near target), in_profit, breakeven, at_loss.
 */
export function detectExitSignals(positions: PositionGroup[]): ExitSignal[] {
  const signals: ExitSignal[] = [];
  const openPositions = positions.filter((p) => p.status === "open");

  for (const pos of openPositions) {
    const absCurrent = Math.abs(pos.currentZScore);
    const absTarget = Math.abs(pos.targetZScore);

    // Signal 1: approaching exit — Z-score within 0.5σ of target
    if (Math.abs(absCurrent - absTarget) < 0.5) {
      signals.push({
        positionId: pos.id,
        signalType: "approaching_exit",
        daysToExit: estimateDaysToExit(pos),
        confidence: Math.max(0, 1 - Math.abs(absCurrent - absTarget) / 0.5),
        reason: `Z-score ${pos.currentZScore.toFixed(2)}σ 接近目标 ${pos.targetZScore > 0 ? "+" : ""}${pos.targetZScore}σ，价差回归中`,
      });
      continue;
    }

    // Signal 2: in profit
    if (pos.unrealizedPnl > 0) {
      const confidence = Math.min(1, pos.unrealizedPnl / (pos.totalMarginUsed * 0.1));
      if (confidence >= 0.3) {
        signals.push({
          positionId: pos.id,
          signalType: "in_profit",
          daysToExit: estimateDaysToExit(pos),
          confidence,
          reason: `当前浮动盈利 ¥${pos.unrealizedPnl.toLocaleString()}，建议关注出场时机`,
        });
      }
      continue;
    }

    // Signal 3: breakeven
    if (Math.abs(pos.unrealizedPnl) < pos.totalMarginUsed * 0.01) {
      signals.push({
        positionId: pos.id,
        signalType: "breakeven",
        daysToExit: estimateDaysToExit(pos),
        confidence: 0.5,
        reason: `处于盈亏平衡附近（¥${pos.unrealizedPnl.toLocaleString()}），注意及时止损或止盈`,
      });
      continue;
    }

    // Signal 4: at loss
    if (pos.unrealizedPnl < 0) {
      signals.push({
        positionId: pos.id,
        signalType: "at_loss",
        daysToExit: estimateDaysToExit(pos),
        confidence: Math.min(1, Math.abs(pos.unrealizedPnl) / (pos.totalMarginUsed * 0.2)),
        reason: `当前浮亏 ¥${Math.abs(pos.unrealizedPnl).toLocaleString()}，亏损已达保证金 ${((Math.abs(pos.unrealizedPnl) / pos.totalMarginUsed) * 100).toFixed(1)}%`,
      });
    }
  }

  // Sort by confidence descending
  return signals.sort((a, b) => b.confidence - a.confidence);
}

// ─── Historical Analytics ──────────────────────────────────────────────────

export interface DailyPnL {
  date: string;
  unrealized: number;
  realized: number;
  cumulative: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  peak: number;
}

export interface WeeklyWinRate {
  week: string;
  winCount: number;
  totalCount: number;
  winRate: number;
}

/**
 * Build cumulative PnL series from closed positions.
 */
export function buildCumulativePnL(
  closedPositions: PositionGroup[],
  lookbackDays: number = 30
): DailyPnL[] {
  if (closedPositions.length === 0) return [];

  // Sort by close date
  const sorted = [...closedPositions].sort(
    (a, b) => new Date(a.closedAt ?? a.openedAt).getTime() - new Date(b.closedAt ?? b.openedAt).getTime()
  );

  const series: DailyPnL[] = [];
  let cumulative = 0;

  for (const pos of sorted) {
    const date = (pos.closedAt ?? pos.openedAt).slice(0, 10);
    const realized = pos.realizedPnl ?? 0;
    cumulative += realized;
    series.push({
      date,
      unrealized: 0,
      realized,
      cumulative,
    });
  }

  return series;
}

/**
 * Build drawdown series from cumulative PnL.
 */
export function buildDrawdownSeries(cumulativePnL: DailyPnL[]): DrawdownPoint[] {
  if (cumulativePnL.length === 0) return [];

  const series: DrawdownPoint[] = [];
  let peak = cumulativePnL[0].cumulative;

  for (const point of cumulativePnL) {
    if (point.cumulative > peak) peak = point.cumulative;
    series.push({
      date: point.date,
      drawdown: peak > 0 ? (peak - point.cumulative) / peak : 0,
      peak,
    });
  }

  return series;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferCategory(strategyName: string): string {
  const name = strategyName.toLowerCase();
  if (name.includes("铜") || name.includes("铝") || name.includes("锌") || name.includes("镍")) return "有色";
  if (name.includes("铁矿") || name.includes("螺纹") || name.includes("热卷") || name.includes("焦煤") || name.includes("焦炭")) return "黑色";
  if (name.includes("原油") || name.includes("燃料油") || name.includes("沥青")) return "能化";
  if (name.includes("大豆") || name.includes("玉米") || name.includes("豆粕") || name.includes("棕榈")) return "农产品";
  if (name.includes("黄金") || name.includes("白银") || name.includes("海外") || name.includes("CBOT")) return "海外";
  return "其他";
}

function estimateSharpe(account: AccountSnapshot): number {
  // Simplified: if we have realized PnL today and margin utilization, approximate
  // A real implementation would use a rolling daily PnL series
  const { todayRealizedPnl, netValue, marginUtilizationRate } = account;
  // Annualize ~252 trading days; assume daily vol = margin_utilization * 0.02
  const annualReturn = (todayRealizedPnl / netValue) * 252;
  const annualVol = marginUtilizationRate * 0.5; // rough
  if (annualVol === 0) return 0;
  return Math.round((annualReturn / annualVol) * 100) / 100;
}

function estimateDaysToExit(pos: PositionGroup): number {
  // Simple estimate: remaining half-life proportion
  const remaining = pos.halfLifeDays - pos.daysHeld;
  return Math.max(0, Math.round(remaining));
}
