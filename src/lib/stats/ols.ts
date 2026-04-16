/**
 * Pure TypeScript OLS (Ordinary Least Squares) regression.
 * No external dependencies — uses direct matrix operations.
 */

export interface OLSResult {
  coeffs: number[];
  residuals: number[];
  tStats: number[];
  rSquared: number;
  /** Standard error of the regression */
  sigma: number;
}

/**
 * OLS regression: y = X·β + ε
 * @param y  Dependent variable (n×1)
 * @param X  Design matrix (n×k), each row is an observation
 * @returns  Coefficients, residuals, t-statistics, R²
 */
export function olsRegress(y: number[], X: number[][]): OLSResult {
  const n = y.length;
  const k = X[0].length;

  // X'X (k×k)
  const XtX = matMul(transpose(X), X);

  // X'y (k×1)
  const Xty = matVecMul(transpose(X), y);

  // β = (X'X)⁻¹ · X'y
  const XtXinv = invertMatrix(XtX);
  const coeffs = matVecMul(XtXinv, Xty);

  // Residuals: e = y - X·β
  const yHat = matVecMul(X, coeffs);
  const residuals = y.map((yi, i) => yi - yHat[i]);

  // σ² = e'e / (n - k)
  const sse = residuals.reduce((s, e) => s + e * e, 0);
  const sigma2 = n > k ? sse / (n - k) : 0;
  const sigma = Math.sqrt(sigma2);

  // t-statistics: β_j / se(β_j), where se(β_j) = σ · sqrt(diag(X'X⁻¹)_j)
  const tStats = coeffs.map((b, j) => {
    const se = Math.sqrt(sigma2 * XtXinv[j][j]);
    return se > 0 ? b / se : 0;
  });

  // R²
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSquared = sst > 0 ? 1 - sse / sst : 0;

  return { coeffs, residuals, tStats, rSquared, sigma };
}

// ── Matrix helpers ──

function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const result: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

/**
 * Matrix inversion via Gauss-Jordan elimination.
 * For small matrices (k ≤ 10) this is perfectly adequate.
 */
function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  // Augmented matrix [M | I]
  const aug: number[][] = M.map((row, i) => {
    const extended = [...row];
    for (let j = 0; j < n; j++) extended.push(i === j ? 1 : 0);
    return extended;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) {
      // Singular matrix — return NaN matrix so callers get NaN coefficients
      // instead of silently wrong results from an identity fallback
      return Array.from({ length: n }, () =>
        Array.from({ length: n }, () => NaN)
      );
    }

    // Scale pivot row
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map((row) => row.slice(n));
}
