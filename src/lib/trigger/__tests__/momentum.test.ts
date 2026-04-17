import { MomentumDetector } from "../momentum";
import type { TriggerContext } from "../base";
import type { MarketDataPoint } from "@/types/domain";

function mkPoint(close: number, volume: number, idx: number): MarketDataPoint {
  return {
    market: "SHFE",
    exchange: "SHFE",
    commodity: "螺纹钢",
    symbol: "RB2501",
    contractMonth: "2501",
    timestamp: `2024-01-${String(idx + 1).padStart(2, "0")}T00:00:00Z`,
    open: close,
    high: close,
    low: close,
    close,
    settle: close,
    volume,
    openInterest: 0,
    currency: "CNY",
    timezone: "Asia/Shanghai",
  };
}

function mkContext(marketData: MarketDataPoint[]): TriggerContext {
  return {
    symbol1: "RB2501",
    category: "ferrous",
    marketData,
    timestamp: "2024-01-25T10:00:00Z",
  };
}

describe("MomentumDetector", () => {
  const detector = new MomentumDetector();

  it("returns null with fewer than 20 data points", async () => {
    const data = Array.from({ length: 10 }, (_, i) => mkPoint(4000, 1000, i));
    expect(await detector.evaluate(mkContext(data))).toBeNull();
  });

  it("returns null for flat prices (no crossover)", async () => {
    // 25 points all at same price — no crossover possible
    const data = Array.from({ length: 25 }, (_, i) => mkPoint(4000, 1000, i));
    // marketData is most-recent-first, so reverse chronological
    data.reverse();
    expect(await detector.evaluate(mkContext(data))).toBeNull();
  });

  it("detects bullish crossover", async () => {
    // Build chronological: 25 points, flat at 4000, last point jumps to 4500
    // After detector reverses marketData, chronological closePrices:
    //   idx 0-23: 4000, idx 24: 4500
    // MA5[24] = (4*4000+4500)/5 = 4100, MA20[24] = (19*4000+4500)/20 = 4025
    // MA5[23] = 4000, MA20[23] = 4000 → MA5 <= MA20 (equal)
    // So bullish cross at idx 24.
    const chronological: MarketDataPoint[] = [];
    for (let i = 0; i < 24; i++) {
      chronological.push(mkPoint(4000, 1000, i));
    }
    chronological.push(mkPoint(4500, 2000, 24)); // big volume on crossover day

    // marketData expects most-recent-first
    const data = [...chronological].reverse();
    const result = await detector.evaluate(mkContext(data));
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.title).toContain("RB2501");
  });

  it("detects bearish crossover", async () => {
    // Opposite: flat at 4000, last point drops to 3500
    // MA5[24] = (4*4000+3500)/5 = 3900, MA20[24] = (19*4000+3500)/20 = 3975
    // MA5[23] = 4000, MA20[23] = 4000 → MA5 >= MA20 (equal)
    // So bearish cross at idx 24.
    const chronological: MarketDataPoint[] = [];
    for (let i = 0; i < 24; i++) {
      chronological.push(mkPoint(4000, 1000, i));
    }
    chronological.push(mkPoint(3500, 2000, 24));

    const data = [...chronological].reverse();
    const result = await detector.evaluate(mkContext(data));
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
  });
});