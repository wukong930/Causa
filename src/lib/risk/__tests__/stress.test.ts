import { runStressTest, extractHistoricalExtremes } from "@/lib/risk/stress";
import type { PositionGroup, MarketDataPoint } from "@/types/domain";

function mkPos(overrides: Partial<PositionGroup> & { id: string; legs: PositionGroup["legs"] }): PositionGroup {
  return { status: "open", ...overrides } as PositionGroup;
}

function mkScenario(shocks: Record<string, number>) {
  return [{ name: "test", description: "test scenario", shocks }];
}

describe("runStressTest", () => {
  it("computes correct P&L for a single long position", () => {
    const positions: PositionGroup[] = [
      mkPos({
        id: "p1",
        legs: [{ asset: "RB2501", direction: "long", currentPrice: 4000, size: 10, marginUsed: 0 }],
      }),
    ];
    const results = runStressTest(positions, mkScenario({ RB: -0.2 }));
    expect(results).toHaveLength(1);
    // 4000 * 10 * (-0.20) * 1 = -8000
    expect(results[0].portfolioPnl).toBe(-8000);
    expect(results[0].positionImpacts[0].pnl).toBe(-8000);
  });

  it("returns zero P&L for empty positions array", () => {
    const results = runStressTest([], mkScenario({ RB: -0.2 }));
    expect(results).toHaveLength(1);
    expect(results[0].portfolioPnl).toBe(0);
    expect(results[0].positionImpacts).toHaveLength(0);
  });

  it("partially cancels P&L for a multi-leg hedge (long RB + short HC)", () => {
    const positions: PositionGroup[] = [
      mkPos({
        id: "hedge1",
        legs: [
          { asset: "RB2501", direction: "long", currentPrice: 4000, size: 10, marginUsed: 0 },
          { asset: "HC2501", direction: "short", currentPrice: 3800, size: 10, marginUsed: 0 },
        ],
      }),
    ];
    const results = runStressTest(positions, mkScenario({ RB: -0.2, HC: -0.2 }));
    // long RB: 4000*10*(-0.2)*1 = -8000
    // short HC: 3800*10*(-0.2)*(-1) = +7600
    // net = -400
    expect(results[0].portfolioPnl).toBe(-400);
  });

  it("skips closed positions", () => {
    const positions: PositionGroup[] = [
      mkPos({
        id: "closed1",
        status: "closed",
        legs: [{ asset: "RB2501", direction: "long", currentPrice: 4000, size: 10, marginUsed: 0 }],
      }),
    ];
    const results = runStressTest(positions, mkScenario({ RB: -0.2 }));
    expect(results[0].portfolioPnl).toBe(0);
    expect(results[0].positionImpacts).toHaveLength(0);
  });
});

// --- extractHistoricalExtremes ---

function mkMarketData(symbol: string, closes: number[]): MarketDataPoint[] {
  return closes.map((close, i) => ({
    timestamp: `2024-01-${String(i + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
    openInterest: 500,
    symbol,
  }));
}

describe("extractHistoricalExtremes", () => {
  it("detects an extreme day when one return exceeds 3 sigma", () => {
    // 30 stable days at 100, then one spike to 200 (100% return, well beyond 3σ)
    const closes = Array(30).fill(100);
    closes.push(200); // extreme day
    const data = mkMarketData("RB2501", closes);

    const scenarios = extractHistoricalExtremes({ RB2501: data });
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    expect(scenarios[0].historical).toBe(true);
    expect(scenarios[0].shocks["RB"]).toBeDefined();
    // The return is 1.0 (100%), which is > 3%, so tail boost 1.3× applies → 1.3
    expect(scenarios[0].shocks["RB"]).toBe(1.3);
  });

  it("returns empty when data has fewer than 20 points", () => {
    const data = mkMarketData("RB2501", [100, 101, 102, 103, 104]);
    const scenarios = extractHistoricalExtremes({ RB2501: data });
    expect(scenarios).toHaveLength(0);
  });
});
