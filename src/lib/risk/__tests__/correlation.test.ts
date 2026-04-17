import { buildCorrelationMatrix } from "@/lib/risk/correlation";
import type { MarketDataPoint } from "@/types/domain";

function mkSeries(symbol: string, closes: number[]): MarketDataPoint[] {
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

describe("buildCorrelationMatrix", () => {
  it("returns correlation ~1.0 for perfectly correlated series", () => {
    // y = 2x + 100 → same daily return direction/magnitude
    const xCloses = Array.from({ length: 30 }, (_, i) => 100 + i);
    const yCloses = xCloses.map((v) => 2 * v + 100);

    const data = {
      A: mkSeries("A", xCloses),
      B: mkSeries("B", yCloses),
    };
    const result = buildCorrelationMatrix(data, ["A", "B"], 60);
    expect(result.matrix[0][1]).toBeCloseTo(1.0, 2);
    expect(result.matrix[1][0]).toBeCloseTo(1.0, 2);
  });

  it("returns correlation ~-1.0 for perfectly negatively correlated series", () => {
    // Build price series where B's returns are the exact negative of A's returns
    const n = 30;
    const aCloses: number[] = [1000];
    const bCloses: number[] = [1000];
    const rets = [0.02, -0.01, 0.03, -0.02, 0.015, -0.005, 0.025, -0.015, 0.01, -0.03,
                  0.02, -0.01, 0.03, -0.02, 0.015, -0.005, 0.025, -0.015, 0.01, -0.03,
                  0.02, -0.01, 0.03, -0.02, 0.015, -0.005, 0.025, -0.015, 0.01];
    for (let i = 0; i < n - 1; i++) {
      aCloses.push(aCloses[i] * (1 + rets[i]));
      bCloses.push(bCloses[i] * (1 - rets[i])); // opposite return
    }

    const data = {
      A: mkSeries("A", aCloses),
      B: mkSeries("B", bCloses),
    };
    const result = buildCorrelationMatrix(data, ["A", "B"], 60);
    expect(result.matrix[0][1]).toBeCloseTo(-1.0, 1);
  });

  it("has diagonal values of 1", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const data = {
      X: mkSeries("X", closes),
      Y: mkSeries("Y", closes.map((c) => c * 1.5)),
    };
    const result = buildCorrelationMatrix(data, ["X", "Y"], 60);
    expect(result.matrix[0][0]).toBe(1);
    expect(result.matrix[1][1]).toBe(1);
  });

  it("returns 0 correlation when data has fewer than 3 points", () => {
    const data = {
      A: mkSeries("A", [100, 101]),
      B: mkSeries("B", [200, 199]),
    };
    const result = buildCorrelationMatrix(data, ["A", "B"], 60);
    // Only 2 data points → 1 return each → pearson gets len<3 → 0
    expect(result.matrix[0][1]).toBe(0);
  });

  it("returns a 1x1 matrix with diagonal 1 for a single symbol", () => {
    const data = { SOLO: mkSeries("SOLO", Array.from({ length: 10 }, (_, i) => 100 + i)) };
    const result = buildCorrelationMatrix(data, ["SOLO"], 60);
    expect(result.symbols).toEqual(["SOLO"]);
    expect(result.matrix).toEqual([[1]]);
  });
});
