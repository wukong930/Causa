import { describe, it, expect } from "vitest";
import { walkForwardTest } from "@/lib/backtest/walk-forward";

const EMPTY_RESULT = {
  sharpeRatio: 0, maxDrawdown: 0, winRate: 0, tradeCount: 0,
  avgHoldingDays: 0, profitFactor: 0, calmarRatio: 0, totalReturn: 0,
};

const baseParams = { entryZ: 2, exitZ: 0.5, stopZ: 4, trainWindow: 60, testWindow: 20 };

describe("walkForwardTest", () => {
  it("returns EMPTY_RESULT when data is insufficient", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    expect(walkForwardTest(closes, closes, baseParams)).toEqual(EMPTY_RESULT);
  });

  it("generates trades on a mean-reverting pair", () => {
    const n = 200;
    const closes1 = Array.from({ length: n }, (_, i) => 100 + Math.sin(i * 0.1) * 5);
    const closes2 = Array.from({ length: n }, (_, i) => 100 + Math.sin(i * 0.1) * 5 - Math.sin(i * 0.05) * 3);
    const result = walkForwardTest(closes1, closes2, baseParams);
    expect(result.tradeCount).toBeGreaterThan(0);
  });

  it("returns EMPTY_RESULT when all prices are identical", () => {
    const flat = Array.from({ length: 200 }, () => 100);
    expect(walkForwardTest(flat, flat, baseParams)).toEqual(EMPTY_RESULT);
  });
});
