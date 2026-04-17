import { describe, it, expect } from "vitest";
import { getAdaptiveThresholds } from "@/lib/trigger/adaptive-threshold";

describe("getAdaptiveThresholds", () => {
  it("returns base zScoreEntry ~2.0 for normal regime without half-life", () => {
    const t = getAdaptiveThresholds("ferrous", "normal");
    // ferrous base is 2.2, normal multiplier is 1.0
    expect(t.zScoreEntry).toBeCloseTo(2.2, 1);
  });

  it("widens zScoreEntry in high vol regime", () => {
    const normal = getAdaptiveThresholds("nonferrous", "normal");
    const high = getAdaptiveThresholds("nonferrous", "high");
    expect(high.zScoreEntry).toBeGreaterThan(normal.zScoreEntry);
  });

  it("tightens zScoreEntry in low vol regime", () => {
    const normal = getAdaptiveThresholds("nonferrous", "normal");
    const low = getAdaptiveThresholds("nonferrous", "low");
    expect(low.zScoreEntry).toBeLessThan(normal.zScoreEntry);
  });

  it("lowers zScoreEntry for short half-life (fast reversion)", () => {
    const base = getAdaptiveThresholds("energy", "normal");
    const fast = getAdaptiveThresholds("energy", "normal", 3);
    expect(fast.zScoreEntry).toBeLessThan(base.zScoreEntry);
  });

  it("raises zScoreEntry for long half-life (slow reversion)", () => {
    const base = getAdaptiveThresholds("energy", "normal");
    const slow = getAdaptiveThresholds("energy", "normal", 25);
    expect(slow.zScoreEntry).toBeGreaterThan(base.zScoreEntry);
  });

  it("clamps all outputs within valid ranges", () => {
    for (const regime of ["high", "low", "normal"] as const) {
      for (const cat of ["ferrous", "nonferrous", "energy", "agriculture"] as const) {
        const t = getAdaptiveThresholds(cat, regime);
        expect(t.zScoreEntry).toBeGreaterThanOrEqual(1.5);
        expect(t.zScoreEntry).toBeLessThanOrEqual(3.5);
        expect(t.volumeSpike).toBeGreaterThanOrEqual(15);
        expect(t.volumeSpike).toBeLessThanOrEqual(60);
        expect(t.basisDeviation).toBeGreaterThanOrEqual(1.0);
        expect(t.basisDeviation).toBeLessThanOrEqual(2.5);
        expect(t.corrBreak).toBeGreaterThanOrEqual(0.15);
        expect(t.corrBreak).toBeLessThanOrEqual(0.5);
        expect(t.minConfidence).toBeGreaterThanOrEqual(0.4);
        expect(t.minConfidence).toBeLessThanOrEqual(0.8);
      }
    }
  });

  it("gives ferrous higher zScoreEntry than nonferrous", () => {
    const ferrous = getAdaptiveThresholds("ferrous", "normal");
    const nonferrous = getAdaptiveThresholds("nonferrous", "normal");
    expect(ferrous.zScoreEntry).toBeGreaterThan(nonferrous.zScoreEntry);
  });
});
