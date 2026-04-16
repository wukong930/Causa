/**
 * Cointegration & stationarity tests — pure TypeScript, zero dependencies.
 *
 * Provides: ADF test, OU half-life, Engle-Granger cointegration, Hurst exponent.
 */
import { olsRegress } from "./ols";

// ── MacKinnon critical values (constant, no trend) ──
// Interpolated for sample sizes 25–500. Format: [1%, 5%, 10%]
const ADF_CRITICAL: Record<number, [number, number, number]> = {
  25:  [-3.75, -3.00, -2.63],
  50:  [-3.58, -2.93, -2.60],
  100: [-3.51, -2.89, -2.58],
  250: [-3.46, -2.87, -2.57],
  500: [-3.44, -2.87, -2.57],
};

function interpolateCritical(n: number): [number, number, number] {
  const keys = Object.keys(ADF_CRITICAL).map(Number).sort((a, b) => a - b);
  if (n <= keys[0]) return ADF_CRITICAL[keys[0]];
  if (n >= keys[keys.length - 1]) return ADF_CRITICAL[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (n >= keys[i] && n <= keys[i + 1]) {
      const t = (n - keys[i]) / (keys[i + 1] - keys[i]);
      const lo = ADF_CRITICAL[keys[i]];
      const hi = ADF_CRITICAL[keys[i + 1]];
      return [
        lo[0] + t * (hi[0] - lo[0]),
        lo[1] + t * (hi[1] - lo[1]),
        lo[2] + t * (hi[2] - lo[2]),
      ];
    }
  }
  return ADF_CRITICAL[keys[keys.length - 1]];
}

export interface ADFResult {
  tStat: number;
  pValue: number;
  lag: number;
  critical: { "1%": number; "5%": number; "10%": number };
}

/**
 * Augmented Dickey-Fuller test for stationarity.
 * H0: series has a unit root (non-stationary)
 * Low p-value → reject H0 → series is stationary
 */
export function adfTest(series: number[], maxLag?: number): ADFResult {
  const n = series.length;
  if (n < 10) {
    return { tStat: 0, pValue: 1, lag: 0, critical: { "1%": -3.75, "5%": -3.00, "10%": -2.63 } };
  }
  // First differences: ΔY_t = Y_t - Y_{t-1}
  const dy: number[] = [];
  for (let i = 1; i < n; i++) dy.push(series[i] - series[i - 1]);

  // Auto-select lag using Schwert criterion: floor(12 * (n/100)^0.25)
  const autoLag = maxLag ?? Math.min(Math.floor(12 * Math.pow(n / 100, 0.25)), Math.floor(n / 3));
  const lag = Math.max(0, autoLag);

  // Build regression: ΔY_t = α + β·Y_{t-1} + Σγ_i·ΔY_{t-i} + ε
  const startIdx = lag;
  const yReg: number[] = [];
  const XReg: number[][] = [];

  for (let t = startIdx; t < dy.length; t++) {
    yReg.push(dy[t]);
    const row: number[] = [1, series[t]]; // constant + Y_{t-1}
    for (let j = 1; j <= lag; j++) {
      row.push(dy[t - j]); // lagged differences
    }
    XReg.push(row);
  }

  if (yReg.length < 5) {
    return { tStat: 0, pValue: 1, lag, critical: { "1%": -3.75, "5%": -3.00, "10%": -2.63 } };
  }

  const ols = olsRegress(yReg, XReg);
  const tStat = ols.tStats[1]; // t-stat for β (coefficient on Y_{t-1})

  // Guard against singular matrix (NaN from OLS)
  if (!isFinite(tStat)) {
    return { tStat: 0, pValue: 1, lag, critical: { "1%": -3.75, "5%": -3.00, "10%": -2.63 } };
  }

  // Approximate p-value from critical values
  const crit = interpolateCritical(yReg.length);
  let pValue: number;
  if (tStat <= crit[0]) pValue = 0.005;       // below 1% critical
  else if (tStat <= crit[1]) pValue = 0.025;   // between 1% and 5%
  else if (tStat <= crit[2]) pValue = 0.075;   // between 5% and 10%
  else pValue = 0.15 + 0.85 * Math.min(1, (tStat - crit[2]) / (0 - crit[2])); // above 10%

  return {
    tStat,
    pValue: Math.max(0.001, Math.min(0.999, pValue)),
    lag,
    critical: { "1%": crit[0], "5%": crit[1], "10%": crit[2] },
  };
}

// ── OU Half-Life ──

export interface OUResult {
  halfLife: number;
  phi: number;
  mu: number;
}

/**
 * Estimate half-life of mean reversion via AR(1) / Ornstein-Uhlenbeck process.
 * Regresses spread_t = μ + φ·spread_{t-1} + ε
 * Half-life = -ln(2) / ln(φ)
 */
export function ouHalfLife(series: number[]): OUResult {
  const n = series.length;
  if (n < 5) return { halfLife: Infinity, phi: 1, mu: 0 };

  const y = series.slice(1);
  const X = series.slice(0, -1).map((v) => [1, v]); // [constant, Y_{t-1}]

  const ols = olsRegress(y, X);
  const mu = ols.coeffs[0];
  const phi = ols.coeffs[1];

  // Guard against NaN from singular matrix
  if (!isFinite(phi)) return { halfLife: Infinity, phi: NaN, mu: NaN };

  // φ must be in (-1, 1) for stationarity; use |φ| for half-life
  if (Math.abs(phi) >= 1) return { halfLife: Infinity, phi, mu };
  if (phi <= 0) {
    // Oscillating mean reversion — half-life from |φ|
    const halfLife = -Math.LN2 / Math.log(Math.abs(phi));
    return { halfLife: Math.max(0.1, halfLife), phi, mu };
  }

  const halfLife = -Math.LN2 / Math.log(phi);
  return { halfLife: Math.max(0.1, halfLife), phi, mu };
}

// ── Engle-Granger Cointegration ──

export interface EngleGrangerResult {
  cointPValue: number;
  hedgeRatio: number;
  residuals: number[];
  adf: ADFResult;
}

/**
 * Engle-Granger two-step cointegration test.
 * Step 1: OLS regression Y = α + β·X → get residuals
 * Step 2: ADF test on residuals
 */
export function engleGranger(
  seriesY: number[],
  seriesX: number[]
): EngleGrangerResult {
  const n = Math.min(seriesY.length, seriesX.length);
  if (n < 10) {
    return {
      cointPValue: 1,
      hedgeRatio: 1,
      residuals: [],
      adf: { tStat: 0, pValue: 1, lag: 0, critical: { "1%": -3.75, "5%": -3.00, "10%": -2.63 } },
    };
  }

  const y = seriesY.slice(0, n);
  const x = seriesX.slice(0, n);

  // Step 1: OLS Y = α + β·X
  const X = x.map((v) => [1, v]);
  const ols = olsRegress(y, X);
  const hedgeRatio = ols.coeffs[1];

  // Step 2: ADF on residuals
  const adf = adfTest(ols.residuals);

  // Cointegration critical values are slightly more negative than standard ADF
  // Apply a small adjustment: multiply p-value by 1.2 (conservative)
  const cointPValue = Math.min(0.999, adf.pValue * 1.2);

  return {
    cointPValue,
    hedgeRatio,
    residuals: ols.residuals,
    adf,
  };
}

// ── Hurst Exponent (R/S Analysis) ──

/**
 * Estimate Hurst exponent using rescaled range (R/S) analysis.
 * IMPORTANT: Pass returns/differences, NOT raw price levels.
 * H < 0.5: mean-reverting
 * H = 0.5: random walk
 * H > 0.5: trending
 */
export function hurstExponent(returns: number[]): number {
  const n = returns.length;
  if (n < 20) return 0.5;

  // Use multiple sub-period sizes
  const sizes = [8, 16, 32, 64, 128].filter((s) => s <= Math.floor(n / 2));
  if (sizes.length < 2) return 0.5;

  const logN: number[] = [];
  const logRS: number[] = [];

  for (const size of sizes) {
    const numBlocks = Math.floor(n / size);
    let rsSum = 0;

    for (let b = 0; b < numBlocks; b++) {
      const block = returns.slice(b * size, (b + 1) * size);
      const mean = block.reduce((s, v) => s + v, 0) / size;
      const deviations = block.map((v) => v - mean);

      // Cumulative deviations
      const cumDev: number[] = [];
      let cum = 0;
      for (const d of deviations) {
        cum += d;
        cumDev.push(cum);
      }

      const range = Math.max(...cumDev) - Math.min(...cumDev);
      const stdDev = Math.sqrt(
        deviations.reduce((s, d) => s + d * d, 0) / size
      );

      if (stdDev > 0) rsSum += range / stdDev;
    }

    const avgRS = rsSum / numBlocks;
    if (avgRS > 0) {
      logN.push(Math.log(size));
      logRS.push(Math.log(avgRS));
    }
  }

  if (logN.length < 2) return 0.5;

  // Linear regression: log(R/S) = H·log(n) + c
  const X = logN.map((v) => [1, v]);
  const ols = olsRegress(logRS, X);
  const H = ols.coeffs[1];

  return Math.max(0, Math.min(1, H));
}
