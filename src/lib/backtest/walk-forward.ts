/**
 * Walk-forward backtest — pure TypeScript, zero dependencies.
 *
 * Simulates a spread trading strategy using rolling windows:
 * - Training window: fit z-score parameters (mean, std)
 * - Testing window: trade using fitted parameters
 * - Roll forward and repeat
 *
 * Returns standard performance metrics: Sharpe, max drawdown, win rate, etc.
 */
import { engleGranger, ouHalfLife } from "@/lib/stats/cointegration";

export interface WalkForwardParams {
  entryZ: number;       // z-score to enter (e.g. 2.0)
  exitZ: number;        // z-score to exit (e.g. 0.5)
  stopZ: number;        // z-score stop-loss (e.g. 4.0)
  trainWindow: number;  // training period in bars (e.g. 60)
  testWindow: number;   // testing period in bars (e.g. 20)
}

export interface WalkForwardResult {
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  avgHoldingDays: number;
  profitFactor: number;
  calmarRatio: number;
  totalReturn: number;
}

interface Trade {
  entryIdx: number;
  exitIdx: number;
  direction: "long" | "short";
  pnl: number;
}

const EMPTY_RESULT: WalkForwardResult = {
  sharpeRatio: 0, maxDrawdown: 0, winRate: 0, tradeCount: 0,
  avgHoldingDays: 0, profitFactor: 0, calmarRatio: 0, totalReturn: 0,
};

/**
 * Run walk-forward backtest on two price series.
 * closes1 and closes2 must be time-ascending and same length.
 */
export function walkForwardTest(
  closes1: number[],
  closes2: number[],
  params: WalkForwardParams
): WalkForwardResult {
  const n = Math.min(closes1.length, closes2.length);
  const { entryZ, exitZ, stopZ, trainWindow, testWindow } = params;

  if (n < trainWindow + testWindow) return EMPTY_RESULT;

  const allTrades: Trade[] = [];
  const dailyPnl: number[] = [];

  // Roll through the data
  for (let start = 0; start + trainWindow + testWindow <= n; start += testWindow) {
    const trainEnd = start + trainWindow;
    const testEnd = Math.min(trainEnd + testWindow, n);

    // Training: fit cointegration on training window
    const trainY = closes1.slice(start, trainEnd);
    const trainX = closes2.slice(start, trainEnd);
    const eg = engleGranger(trainY, trainX);

    if (eg.residuals.length === 0) continue;

    const residuals = eg.residuals;
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const std = Math.sqrt(
      residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / residuals.length
    );
    if (std === 0) continue;

    // Testing: trade using fitted parameters
    let inPosition = false;
    let direction: "long" | "short" = "long";
    let entryIdx = 0;
    let entrySpread = 0;

    for (let t = trainEnd; t < testEnd; t++) {
      // Compute spread using hedge ratio from training
      const spread = closes1[t] - eg.hedgeRatio * closes2[t];
      const z = (spread - mean) / std;

      if (!inPosition) {
        // Entry: z-score crosses threshold
        if (z > entryZ) {
          inPosition = true;
          direction = "short"; // spread too high, short spread
          entryIdx = t;
          entrySpread = spread;
        } else if (z < -entryZ) {
          inPosition = true;
          direction = "long"; // spread too low, long spread
          entryIdx = t;
          entrySpread = spread;
        }
        // No dailyPnl push when flat — avoids inflating Sharpe denominator
      } else {
        // Daily P&L
        const prevSpread = closes1[t - 1] - eg.hedgeRatio * closes2[t - 1];
        const dPnl = direction === "long"
          ? spread - prevSpread
          : prevSpread - spread;
        dailyPnl.push(dPnl);

        // Exit conditions
        const shouldExit =
          (direction === "long" && z >= -exitZ) ||
          (direction === "short" && z <= exitZ) ||
          Math.abs(z) > stopZ;

        if (shouldExit || t === testEnd - 1) {
          const pnl = direction === "long"
            ? spread - entrySpread
            : entrySpread - spread;
          allTrades.push({ entryIdx, exitIdx: t, direction, pnl });
          inPosition = false;
        }
      }
    }
  }

  if (allTrades.length === 0) return EMPTY_RESULT;

  // Compute metrics
  const wins = allTrades.filter((t) => t.pnl > 0);
  const losses = allTrades.filter((t) => t.pnl <= 0);
  const winRate = wins.length / allTrades.length;
  const totalReturn = allTrades.reduce((s, t) => s + t.pnl, 0);
  const avgHoldingDays = allTrades.reduce((s, t) => s + (t.exitIdx - t.entryIdx), 0) / allTrades.length;

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Sharpe ratio (annualized, assuming daily)
  const meanDaily = dailyPnl.length > 0
    ? dailyPnl.reduce((a, b) => a + b, 0) / dailyPnl.length
    : 0;
  const stdDaily = dailyPnl.length > 1
    ? Math.sqrt(dailyPnl.reduce((a, b) => a + (b - meanDaily) ** 2, 0) / (dailyPnl.length - 1))
    : 0;
  const sharpeRatio = stdDaily > 0 ? (meanDaily / stdDaily) * Math.sqrt(252) : 0;

  // Max drawdown
  let peak = 0;
  let cumPnl = 0;
  let maxDrawdown = 0;
  for (const pnl of dailyPnl) {
    cumPnl += pnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const calmarRatio = maxDrawdown > 0 ? (totalReturn / maxDrawdown) : 0;

  return {
    sharpeRatio: round(sharpeRatio),
    maxDrawdown: round(maxDrawdown),
    winRate: round(winRate),
    tradeCount: allTrades.length,
    avgHoldingDays: round(avgHoldingDays),
    profitFactor: round(profitFactor),
    calmarRatio: round(calmarRatio),
    totalReturn: round(totalReturn),
  };
}

function round(v: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
