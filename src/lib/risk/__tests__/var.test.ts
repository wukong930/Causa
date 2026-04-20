import { describe, it, expect } from "vitest";
import { calculateVaR } from "@/lib/risk/var";
import type { PositionGroup, MarketDataPoint } from "@/types/domain";

function makeMarketData(closes: number[]): MarketDataPoint[] {
  return closes.map((close, i) => ({
    market: "SHFE", exchange: "SHFE", commodity: "RB", symbol: "RB2506",
    contractMonth: "2506", timestamp: `2025-01-${String(i + 1).padStart(2, "0")}`,
    open: close, high: close + 1, low: close - 1, close,
    settle: close, volume: 1000, openInterest: 5000,
    currency: "CNY", timezone: "Asia/Shanghai",
  }));
}

function makePosition(overrides?: Partial<PositionGroup>): PositionGroup {
  return {
    id: "p1", legs: [], openedAt: "2025-01-01", entrySpread: 0,
    currentSpread: 0, spreadUnit: "CNY", unrealizedPnl: 0,
    totalMarginUsed: 10000, exitCondition: "", targetZScore: 0.5,
    currentZScore: 1.0, halfLifeDays: 10, daysHeld: 5, status: "open",
    ...overrides,
  };
}

describe("calculateVaR", () => {
  it("returns all zeros for empty positions", () => {
    const result = calculateVaR([], {});
    expect(result.var95).toBe(0);
    expect(result.var99).toBe(0);
    expect(result.cvar95).toBe(0);
    expect(result.cvar99).toBe(0);
  });

  it("computes negative VaR (loss semantics) for a single position with varying prices", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 3500 + Math.sin(i * 0.3) * 50);
    const pos = makePosition({
      legs: [{ asset: "RB2506", direction: "long", size: 10, currentPrice: 3500, entryPrice: 3450, unit: "吨", unrealizedPnl: 500, marginUsed: 5000 }],
    });
    const result = calculateVaR([pos], { RB2506: makeMarketData(closes) });
    expect(result.var95).toBeLessThan(0);
    expect(result.var99).toBeLessThanOrEqual(result.var95);
  });

  it("returns zero VaR when all prices are identical", () => {
    const closes = Array.from({ length: 50 }, () => 3500);
    const pos = makePosition({
      legs: [{ asset: "RB2506", direction: "long", size: 10, currentPrice: 3500, entryPrice: 3500, unit: "吨", unrealizedPnl: 0, marginUsed: 5000 }],
    });
    const result = calculateVaR([pos], { RB2506: makeMarketData(closes) });
    expect(result.var95).toBe(0);
    expect(result.var99).toBe(0);
  });
});
