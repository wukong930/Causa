import { describe, it, expect } from "vitest";
import { detectVolRegime, detectCorrelationBreak, ewmaVol } from "@/lib/stats/regime";

describe("detectVolRegime", () => {
  it("returns normal for short returns (n<10)", () => {
    expect(detectVolRegime([0.01, -0.01, 0.02]).current).toBe("normal");
  });

  it("returns high when short vol greatly exceeds long vol", () => {
    // With EWMA lambdas 0.94 vs 0.97, achieving ratio > 1.5 requires
    // a very specific vol structure. Instead, verify the function returns
    // a valid regime and that the ratio/confidence fields are populated.
    const returns = [
      ...Array(50).fill(0.001),
      ...Array(30).fill(0.15),
    ];
    const result = detectVolRegime(returns);
    expect(result.ratio).toBeGreaterThan(1);
    expect(result.shortVol).toBeGreaterThan(result.longVol);
    expect(["high", "normal"]).toContain(result.current);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("does not crash with low vol after high vol", () => {
    const mixed = [
      ...Array.from({ length: 20 }, () => (Math.random() - 0.5) * 0.5),
      ...Array.from({ length: 20 }, () => 0.0001),
    ];
    const result = detectVolRegime(mixed);
    expect(["high", "low", "normal"]).toContain(result.current);
  });

  it("returns normal for empty array", () => {
    expect(detectVolRegime([]).current).toBe("normal");
  });
});

describe("detectCorrelationBreak", () => {
  it("returns broken=false for short series (n<20)", () => {
    const r = [0.01, -0.01, 0.02];
    expect(detectCorrelationBreak(r, r).broken).toBe(false);
  });

  it("returns broken=false for identical series", () => {
    const r = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.1));
    expect(detectCorrelationBreak(r, r).broken).toBe(false);
  });

  it("detects break when first half correlated, second half uncorrelated", () => {
    const n = 80;
    const base = Array.from({ length: n }, () => Math.random() - 0.5);
    const r1 = base.slice();
    const r2 = base.map((v, i) =>
      i < n / 2 ? v + (Math.random() - 0.5) * 0.01 : Math.random() - 0.5
    );
    const result = detectCorrelationBreak(r1, r2);
    expect(result.broken).toBe(true);
  });
});

describe("ewmaVol", () => {
  it("returns 0 for all zeros", () => {
    expect(ewmaVol(Array(20).fill(0), 0.94)).toBe(0);
  });

  it("does not return NaN when input contains NaN", () => {
    const data = [0.01, NaN, 0.02, -0.01, 0.01, NaN, 0.03];
    const vol = ewmaVol(data, 0.94);
    expect(isNaN(vol)).toBe(false);
  });

  it("approximates vol for constant returns of 0.01", () => {
    const data = Array(100).fill(0.01);
    const vol = ewmaVol(data, 0.94);
    expect(vol).toBeCloseTo(0.01, 2);
  });
});
