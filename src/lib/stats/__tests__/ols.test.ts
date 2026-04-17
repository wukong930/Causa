import { describe, it, expect } from "vitest";
import { olsRegress } from "@/lib/stats/ols";

describe("olsRegress", () => {
  it("returns empty result for empty arrays", () => {
    const result = olsRegress([], []);
    expect(result.coeffs).toEqual([]);
    expect(result.residuals).toEqual([]);
  });

  it("recovers y = 2x + 1 exactly", () => {
    const X = [[1,1],[1,2],[1,3],[1,4],[1,5]];
    const y = [3, 5, 7, 9, 11];
    const result = olsRegress(y, X);
    expect(result.coeffs[0]).toBeCloseTo(1, 5);
    expect(result.coeffs[1]).toBeCloseTo(2, 5);
    expect(result.rSquared).toBeCloseTo(1.0, 5);
  });

  it("does not crash on single observation", () => {
    const result = olsRegress([5], [[1, 3]]);
    expect(result.coeffs).toHaveLength(2);
    expect(result.residuals).toHaveLength(1);
  });

  it("returns NaN coefficients for singular matrix", () => {
    const X = [[1,2],[1,2],[1,2],[1,2]];
    const y = [1, 2, 3, 4];
    const result = olsRegress(y, X);
    expect(result.coeffs.some((c) => isNaN(c))).toBe(true);
  });
});
