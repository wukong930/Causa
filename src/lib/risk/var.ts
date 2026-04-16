import type { PositionGroup, MarketDataPoint } from "@/types/domain";

export interface VaRResult {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  horizon: number;
  method: "historical" | "parametric";
  calculatedAt: string;
}

/**
 * Calculate VaR and CVaR using historical simulation.
 * Uses daily P&L changes from market data.
 */
export function calculateVaR(
  positions: PositionGroup[],
  marketDataBySymbol: Record<string, MarketDataPoint[]>,
  horizon: number = 1
): VaRResult {
  // Collect daily P&L changes for each position
  const dailyPnls: number[] = [];

  for (const pos of positions) {
    if (pos.status !== "open") continue;

    for (const leg of pos.legs) {
      const data = marketDataBySymbol[leg.asset];
      if (!data || data.length < 2) continue;

      // Cap to last 252 trading days to bound memory usage
      const capped = data.length > 253 ? data.slice(-253) : data;

      // Calculate daily returns
      for (let i = 1; i < capped.length; i++) {
        const prevClose = capped[i - 1].close;
        const currClose = capped[i].close;
        if (prevClose === 0) continue;

        const dailyReturn = (currClose - prevClose) / prevClose;
        const positionPnl = dailyReturn * (leg.currentPrice ?? 0) * (leg.size ?? 0) * (leg.direction === "long" ? 1 : -1);
        dailyPnls.push(positionPnl);
      }
    }
  }

  if (dailyPnls.length === 0) {
    return {
      var95: 0, var99: 0, cvar95: 0, cvar99: 0,
      horizon, method: "historical", calculatedAt: new Date().toISOString(),
    };
  }

  // Sort ascending (worst losses first)
  const sorted = [...dailyPnls].sort((a, b) => a - b);
  const n = sorted.length;

  // VaR at confidence levels
  const idx95 = Math.floor(n * 0.05);
  const idx99 = Math.floor(n * 0.01);

  const var95 = Math.abs(sorted[idx95] ?? 0) * Math.sqrt(horizon);
  const var99 = Math.abs(sorted[idx99] ?? 0) * Math.sqrt(horizon);

  // CVaR (Expected Shortfall): average of losses beyond VaR
  const cvar95 = Math.abs(
    sorted.slice(0, idx95 + 1).reduce((s, v) => s + v, 0) / (idx95 + 1)
  ) * Math.sqrt(horizon);

  const cvar99 = Math.abs(
    sorted.slice(0, Math.max(idx99, 1)).reduce((s, v) => s + v, 0) / Math.max(idx99, 1)
  ) * Math.sqrt(horizon);

  return {
    var95: Math.round(var95),
    var99: Math.round(var99),
    cvar95: Math.round(cvar95),
    cvar99: Math.round(cvar99),
    horizon,
    method: "historical",
    calculatedAt: new Date().toISOString(),
  };
}
