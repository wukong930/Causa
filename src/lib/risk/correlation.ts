import type { MarketDataPoint } from "@/types/domain";

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // NxN correlation coefficients
  window: number;     // rolling window in days
  calculatedAt: string;
}

/**
 * Build a rolling correlation matrix from daily close prices.
 */
export function buildCorrelationMatrix(
  marketDataBySymbol: Record<string, MarketDataPoint[]>,
  symbols: string[],
  window: number = 60
): CorrelationMatrix {
  // Collect daily returns for each symbol
  const returnsBySymbol: Record<string, number[]> = {};

  for (const sym of symbols) {
    const data = marketDataBySymbol[sym];
    if (!data || data.length < 2) {
      returnsBySymbol[sym] = [];
      continue;
    }
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const slice = sorted.slice(-window - 1);
    const returns: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      const prev = slice[i - 1].close;
      const curr = slice[i].close;
      if (prev === 0 || !Number.isFinite(prev) || !Number.isFinite(curr)) {
        returns.push(0);
        continue;
      }
      const ret = (curr - prev) / prev;
      returns.push(Number.isFinite(ret) ? ret : 0);
    }
    returnsBySymbol[sym] = returns;
  }

  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const corr = pearsonCorrelation(
        returnsBySymbol[symbols[i]] ?? [],
        returnsBySymbol[symbols[j]] ?? []
      );
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return {
    symbols,
    matrix,
    window,
    calculatedAt: new Date().toISOString(),
  };
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const len = Math.min(x.length, y.length);
  if (len < 3) return 0;

  const xs = x.slice(-len);
  const ys = y.slice(-len);

  const meanX = xs.reduce((s, v) => s + v, 0) / len;
  const meanY = ys.reduce((s, v) => s + v, 0) / len;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < len; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;
  return Math.round((num / den) * 1000) / 1000;
}
