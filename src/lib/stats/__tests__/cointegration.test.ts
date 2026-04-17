import { describe, it, expect } from "vitest";
import { adfTest, ouHalfLife, engleGranger, hurstExponent } from "@/lib/stats/cointegration";

// Helper: seeded pseudo-random for reproducibility
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Helper: Box-Muller normal
function randn(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

describe("adfTest", () => {
  it("returns pValue=1 for short series (n<10)", () => {
    expect(adfTest([1, 2, 3]).pValue).toBe(1);
  });

  it("rejects unit root for stationary sine wave", () => {
    const rng = makeRng(42);
    const series = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.3) + randn(rng) * 0.1);
    const result = adfTest(series);
    expect(result.pValue).toBeLessThan(0.10);
  });

  it("fails to reject unit root for random walk", () => {
    const rng = makeRng(99);
    const walk: number[] = [0];
    for (let i = 1; i < 200; i++) walk.push(walk[i - 1] + randn(rng));
    const result = adfTest(walk);
    expect(result.pValue).toBeGreaterThan(0.10);
  });
});

describe("ouHalfLife", () => {
  it("returns halfLife=Infinity for short series (n<5)", () => {
    expect(ouHalfLife([1, 2, 3]).halfLife).toBe(Infinity);
  });

  it("estimates half-life for AR(1) with phi=0.9", () => {
    const rng = makeRng(77);
    const series: number[] = [0];
    for (let i = 1; i < 500; i++) {
      series.push(0.9 * series[i - 1] + randn(rng) * 0.1);
    }
    const result = ouHalfLife(series);
    const expected = -Math.LN2 / Math.log(0.9); // ~6.58
    // Allow ±3 tolerance — finite sample bias is expected
    expect(result.halfLife).toBeGreaterThan(expected - 3);
    expect(result.halfLife).toBeLessThan(expected + 3);
  });

  it("returns finite half-life for oscillating (phi<0) series", () => {
    const rng = makeRng(55);
    const series: number[] = [0];
    for (let i = 1; i < 200; i++) {
      series.push(-0.5 * series[i - 1] + randn(rng) * 0.1);
    }
    const result = ouHalfLife(series);
    expect(isFinite(result.halfLife)).toBe(true);
  });
});

describe("engleGranger", () => {
  it("returns cointPValue=1 for short series (n<10)", () => {
    expect(engleGranger([1, 2], [3, 4]).cointPValue).toBe(1);
  });

  it("detects cointegration for Y = 2*X + noise", () => {
    const rng = makeRng(123);
    const xSeries: number[] = [100];
    for (let i = 1; i < 200; i++) xSeries.push(xSeries[i - 1] + randn(rng));
    const ySeries = xSeries.map((x) => 2 * x + randn(rng) * 0.5);

    const result = engleGranger(ySeries, xSeries);
    expect(result.cointPValue).toBeLessThan(0.10);
    expect(result.hedgeRatio).toBeCloseTo(2, 0);
  });
});

describe("hurstExponent", () => {
  it("returns H < 0.5 for mean-reverting returns", () => {
    const rng = makeRng(200);
    // Mean-reverting: returns that oscillate
    const returns = Array.from({ length: 300 }, (_, i) =>
      Math.sin(i * 0.5) * 0.01 + randn(rng) * 0.001
    );
    const H = hurstExponent(returns);
    expect(H).toBeLessThan(0.5);
  });

  it("returns H > 0.5 for trending returns", () => {
    const rng = makeRng(300);
    // Trending: cumulative sum of positive-biased noise → returns are autocorrelated
    const raw: number[] = [];
    let cum = 0;
    for (let i = 0; i < 300; i++) {
      cum += 0.01 + randn(rng) * 0.001;
      raw.push(cum);
    }
    // Returns of the cumulative series
    const returns = raw.slice(1).map((v, i) => v - raw[i]);
    const H = hurstExponent(returns);
    expect(H).toBeGreaterThan(0.5);
  });

  it("returns 0.5 for short series (n<20)", () => {
    expect(hurstExponent([0.01, -0.01, 0.02])).toBe(0.5);
  });

  it("returns 0.5 for all-zero returns", () => {
    expect(hurstExponent(Array(30).fill(0))).toBe(0.5);
  });
});
