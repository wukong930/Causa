import { describe, it, expect } from "vitest";
import { ensembleSignals } from "@/lib/trigger/ensemble";
import type { TriggerResult } from "@/lib/trigger/base";

function makeTriggerResult(overrides?: Partial<TriggerResult>): TriggerResult {
  return {
    triggered: true, severity: "medium", confidence: 0.8,
    triggerChain: [], relatedAssets: ["RB2506"], riskItems: [],
    manualCheckItems: [], title: "test", summary: "test",
    ...overrides,
  };
}

describe("ensembleSignals", () => {
  it("returns empty alerts and signalCount=0 for empty input", () => {
    const out = ensembleSignals([]);
    expect(out.alerts).toHaveLength(0);
    expect(out.signalCount).toBe(0);
  });

  it("applies no resonance boost for a single signal", () => {
    const out = ensembleSignals([
      { type: "spread_anomaly", result: makeTriggerResult({ confidence: 0.8 }) },
    ]);
    expect(out.alerts).toHaveLength(1);
    // single signal: resonance = 1.0, so confidence unchanged
    expect(out.alerts[0].result.confidence).toBeCloseTo(0.8, 2);
  });

  it("applies resonance boost (x1.2, capped 0.95) for two signals", () => {
    const out = ensembleSignals([
      { type: "spread_anomaly", result: makeTriggerResult({ confidence: 0.8 }) },
      { type: "momentum", result: makeTriggerResult({ confidence: 0.7 }) },
    ]);
    expect(out.alerts.length).toBeGreaterThanOrEqual(1);
    const spread = out.alerts.find((a) => a.type === "spread_anomaly");
    // 0.8 * 1.2 = 0.96 → capped at 0.95
    expect(spread!.result.confidence).toBeCloseTo(0.95, 2);
  });

  it("dampens spread_anomaly confidence when regime_shift present", () => {
    const out = ensembleSignals([
      { type: "regime_shift", result: makeTriggerResult({ confidence: 0.8 }) },
      { type: "spread_anomaly", result: makeTriggerResult({ confidence: 0.8 }) },
    ]);
    const spread = out.alerts.find((a) => a.type === "spread_anomaly");
    // 0.8 * 0.7 (damp) * 1.2 (resonance) = 0.672
    expect(spread!.result.confidence).toBeCloseTo(0.672, 2);
  });

  it("dampens basis_shift confidence when regime_shift present", () => {
    const out = ensembleSignals([
      { type: "regime_shift", result: makeTriggerResult({ confidence: 0.8 }) },
      { type: "basis_shift", result: makeTriggerResult({ confidence: 0.8 }) },
    ]);
    const basis = out.alerts.find((a) => a.type === "basis_shift");
    // 0.8 * 0.75 (damp) * 1.2 (resonance) = 0.72
    expect(basis!.result.confidence).toBeCloseTo(0.72, 2);
  });

  it("suppresses low-confidence signal when stronger signal exists", () => {
    const out = ensembleSignals([
      { type: "spread_anomaly", result: makeTriggerResult({ confidence: 0.9 }) },
      { type: "event_driven", result: makeTriggerResult({ confidence: 0.2 }) },
    ]);
    // 0.2 * 1.2 = 0.24; max = min(0.95, 0.9*1.2) = 0.95; 0.24 < 0.95*0.4=0.38 → suppressed
    expect(out.suppressed.length).toBeGreaterThanOrEqual(1);
    expect(out.suppressed.some((s) => s.type === "event_driven")).toBe(true);
  });
});
