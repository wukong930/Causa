import { SpreadAnomalyDetector } from "../spread-anomaly";
import type { TriggerContext } from "../base";
import type { SpreadStatistics } from "@/types/domain";

function mkContext(overrides: Partial<TriggerContext> = {}): TriggerContext {
  return {
    symbol1: "RB2501",
    symbol2: "RB2505",
    category: "ferrous",
    marketData: [],
    timestamp: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

function mkSpreadStats(overrides: Partial<SpreadStatistics> = {}): SpreadStatistics {
  return {
    symbol1: "RB2501",
    symbol2: "RB2505",
    window: 60,
    spreadMean: 100,
    spreadStdDev: 30,
    currentZScore: 2.5,
    halfLife: 10,
    adfPValue: 0.03,
    sampleCount: 60,
    ...overrides,
  };
}

describe("SpreadAnomalyDetector", () => {
  const detector = new SpreadAnomalyDetector();

  it("returns null when spreadStats is missing", async () => {
    const result = await detector.evaluate(mkContext({ spreadStats: undefined }));
    expect(result).toBeNull();
  });

  it("returns null when symbol2 is missing", async () => {
    const result = await detector.evaluate(
      mkContext({ symbol2: undefined, spreadStats: mkSpreadStats() })
    );
    expect(result).toBeNull();
  });

  it("returns null when z-score is below threshold", async () => {
    // ferrous zScoreEntry = 2.2 (normal regime)
    const result = await detector.evaluate(
      mkContext({ spreadStats: mkSpreadStats({ currentZScore: 1.0 }) })
    );
    expect(result).toBeNull();
  });

  it("triggers with severity high for z-score 2.7 and ADF < 0.05", async () => {
    const result = await detector.evaluate(
      mkContext({ spreadStats: mkSpreadStats({ currentZScore: 2.7, adfPValue: 0.03 }) })
    );
    expect(result).not.toBeNull();
    expect(result!.triggered).toBe(true);
    expect(result!.severity).toBe("high");
    expect(result!.relatedAssets).toContain("RB2501");
  });

  it("triggers with severity critical for extreme z-score", async () => {
    const result = await detector.evaluate(
      mkContext({ spreadStats: mkSpreadStats({ currentZScore: 3.5 }) })
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
  });
});