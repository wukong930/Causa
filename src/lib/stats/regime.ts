/**
 * Statistical regime detection — EWMA volatility regime + correlation break.
 * Pure TypeScript, zero dependencies.
 */

export interface VolRegimeResult {
  current: "high" | "low" | "normal";
  shortVol: number;
  longVol: number;
  ratio: number;
  confidence: number;
}

/**
 * Detect volatility regime using EWMA (Exponentially Weighted Moving Average).
 * Compares short-term EWMA(λ=0.94) vs long-term EWMA(λ=0.97).
 * Ratio > 1.5 → high vol regime; < 0.67 → low vol regime.
 */
export function detectVolRegime(returns: number[]): VolRegimeResult {
  if (returns.length < 10) {
    return { current: "normal", shortVol: 0, longVol: 0, ratio: 1, confidence: 0 };
  }

  const shortVol = ewmaVol(returns, 0.94);
  const longVol = ewmaVol(returns, 0.97);

  if (longVol === 0) {
    return { current: "normal", shortVol, longVol, ratio: 1, confidence: 0 };
  }

  const ratio = shortVol / longVol;

  let current: "high" | "low" | "normal";
  let confidence: number;

  if (ratio > 1.5) {
    current = "high";
    confidence = Math.min(0.95, 0.6 + (ratio - 1.5) * 0.35);
  } else if (ratio < 0.67) {
    current = "low";
    confidence = Math.min(0.95, 0.6 + (0.67 - ratio) * 0.7);
  } else {
    current = "normal";
    confidence = 0.5 + 0.3 * (1 - Math.abs(ratio - 1));
  }

  return { current, shortVol, longVol, ratio, confidence };
}

function ewmaVol(returns: number[], lambda: number): number {
  // Initialize with sample variance of first 10 observations (or all if fewer)
  const initN = Math.min(10, returns.length);
  let variance = 0;
  for (let i = 0; i < initN; i++) variance += returns[i] ** 2;
  variance /= initN;

  for (let i = initN; i < returns.length; i++) {
    variance = lambda * variance + (1 - lambda) * returns[i] ** 2;
  }
  return Math.sqrt(variance);
}

// ── Correlation Break Detection ──

export interface CorrelationBreakResult {
  broken: boolean;
  shortCorr: number;
  longCorr: number;
  delta: number;
  confidence: number;
}

/**
 * Detect correlation breakdown between two return series.
 * Compares rolling 20-day vs 60-day Pearson correlation.
 * |delta| > 0.3 → correlation break.
 */
export function detectCorrelationBreak(
  returns1: number[],
  returns2: number[]
): CorrelationBreakResult {
  const n = Math.min(returns1.length, returns2.length);
  if (n < 20) {
    return { broken: false, shortCorr: 0, longCorr: 0, delta: 0, confidence: 0 };
  }

  const shortWindow = Math.min(20, n);
  const longWindow = Math.min(60, n);

  const shortCorr = pearsonCorr(
    returns1.slice(-shortWindow),
    returns2.slice(-shortWindow)
  );
  const longCorr = pearsonCorr(
    returns1.slice(-longWindow),
    returns2.slice(-longWindow)
  );

  const delta = shortCorr - longCorr;
  const broken = Math.abs(delta) > 0.3;
  const confidence = broken
    ? Math.min(0.95, 0.6 + (Math.abs(delta) - 0.3) * 1.5)
    : 0.3;

  return { broken, shortCorr, longCorr, delta, confidence };
}

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;

  let cov = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    cov += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }

  const denom = Math.sqrt(sx * sy);
  return denom > 0 ? cov / denom : 0;
}
