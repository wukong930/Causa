import type { PositionGroup, MarketDataPoint } from "@/types/domain";
import { ewmaVol } from "@/lib/stats/regime";

export interface VaRResult {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  horizon: number;
  method: "historical" | "parametric" | "combined";
  calculatedAt: string;
}

/**
 * Calculate VaR and CVaR using combined historical + parametric approach.
 * Historical: percentile-based from daily P&L.
 * Parametric: EWMA volatility + Cornish-Fisher expansion for skewness/kurtosis.
 * Final: max(historical, parametric) — conservative.
 */
export function calculateVaR(
  positions: PositionGroup[],
  marketDataBySymbol: Record<string, MarketDataPoint[]>,
  horizon: number = 1
): VaRResult {
  const dailyPnls: number[] = [];

  for (const pos of positions) {
    if (pos.status !== "open") continue;
    for (const leg of pos.legs) {
      const data = marketDataBySymbol[leg.asset];
      if (!data || data.length < 2) continue;
      const capped = data.length > 504 ? data.slice(-504) : data;
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

  const empty: VaRResult = {
    var95: 0, var99: 0, cvar95: 0, cvar99: 0,
    horizon, method: "combined", calculatedAt: new Date().toISOString(),
  };
  if (dailyPnls.length < 10) return empty;

  // ── Historical VaR ──
  const sorted = [...dailyPnls].sort((a, b) => a - b);
  const n = sorted.length;
  const idx95 = Math.max(0, Math.floor(n * 0.05));
  const idx99 = Math.max(0, Math.floor(n * 0.01));

  const histVar95 = sorted[idx95] ?? 0;
  const histVar99 = sorted[idx99] ?? 0;
  const histCvar95 =
    sorted.slice(0, idx95 + 1).reduce((s, v) => s + v, 0) / (idx95 + 1);
  const histCvar99 =
    sorted.slice(0, Math.max(idx99, 1)).reduce((s, v) => s + v, 0) / Math.max(idx99, 1);

  // ── Parametric VaR (EWMA + Cornish-Fisher) ──
  const sigma = ewmaVol(dailyPnls, 0.94);
  const mean = dailyPnls.reduce((a, b) => a + b, 0) / n;

  // Skewness and excess kurtosis
  const m2 = dailyPnls.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const m3 = dailyPnls.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  const m4 = dailyPnls.reduce((a, b) => a + (b - mean) ** 4, 0) / n;
  const skew = m2 > 0 ? m3 / (m2 ** 1.5) : 0;
  const exKurt = m2 > 0 ? m4 / (m2 ** 2) - 3 : 0;

  // Cornish-Fisher expansion: z_cf = z + (z²-1)·S/6 + (z³-3z)·K/24 - (2z³-5z)·S²/36
  const z95 = cornishFisher(1.645, skew, exKurt);
  const z99 = cornishFisher(2.326, skew, exKurt);

  const paramVar95 = mean - sigma * z95;
  const paramVar99 = mean - sigma * z99;
  // Parametric CVaR approximation: σ × φ(z) / (1-α)
  const paramCvar95 = sigma * normalPdf(z95) / 0.05;
  const paramCvar99 = sigma * normalPdf(z99) / 0.01;

  // ── Combined: take conservative (max) ──
  // For multi-day horizon, scale by sqrt(horizon) for parametric,
  // but use direct multi-day returns for historical when available
  const hScale = Math.sqrt(Math.max(1, horizon));

  return {
    var95: Math.round(Math.min(histVar95, paramVar95) * hScale),
    var99: Math.round(Math.min(histVar99, paramVar99) * hScale),
    cvar95: Math.round(Math.min(histCvar95, paramCvar95) * hScale),
    cvar99: Math.round(Math.min(histCvar99, paramCvar99) * hScale),
    horizon,
    method: "combined",
    calculatedAt: new Date().toISOString(),
  };
}

/** Cornish-Fisher expansion for non-normal quantile */
function cornishFisher(z: number, skew: number, exKurt: number): number {
  // Clamp skew/kurtosis to avoid extreme adjustments
  const S = Math.max(-2, Math.min(2, skew));
  const K = Math.max(-3, Math.min(10, exKurt));
  return z
    + (z * z - 1) * S / 6
    + (z * z * z - 3 * z) * K / 24
    - (2 * z * z * z - 5 * z) * S * S / 36;
}

/** Standard normal PDF */
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
