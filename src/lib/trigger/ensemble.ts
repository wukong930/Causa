/**
 * Signal ensemble — aggregates multiple trigger evaluator results
 * to produce higher-quality alerts with reduced noise.
 *
 * Key behaviors:
 * - Multi-signal resonance: ≥2 triggers → confidence boost (×1.2, cap 0.95)
 * - Conflict dampening: regime_shift + spread_anomaly → lower spread confidence
 *   (regime change may invalidate mean-reversion assumption)
 * - Weighted aggregation: spread_anomaly has highest weight
 */
import type { AlertType } from "@/types/domain";
import type { TriggerResult } from "./base";

interface EvaluatorResult {
  type: AlertType;
  result: TriggerResult;
}

export interface EnsembleOutput {
  /** Alerts to actually create (filtered and adjusted) */
  alerts: EvaluatorResult[];
  /** Signals that were suppressed by ensemble logic */
  suppressed: Array<{ type: AlertType; reason: string }>;
  /** Overall market signal summary */
  signalCount: number;
  ensembleConfidence: number;
}

/** Relative importance of each signal type for ensemble weighting */
const SIGNAL_WEIGHTS: Record<string, number> = {
  spread_anomaly: 1.0,
  basis_shift: 0.85,
  momentum: 0.7,
  regime_shift: 0.9,
  inventory_shock: 0.75,
  event_driven: 0.6,
};

/**
 * Run ensemble logic on collected trigger results.
 * Call this instead of creating alerts per-evaluator.
 */
export function ensembleSignals(results: EvaluatorResult[]): EnsembleOutput {
  const triggered = results.filter((r) => r.result.triggered);
  const suppressed: EnsembleOutput["suppressed"] = [];

  if (triggered.length === 0) {
    return { alerts: [], suppressed: [], signalCount: 0, ensembleConfidence: 0 };
  }

  const types = new Set(triggered.map((r) => r.type));
  const hasRegimeShift = types.has("regime_shift");

  // ── Conflict: regime_shift + spread_anomaly / basis_shift ──
  // Regime change may invalidate mean-reversion and basis assumptions
  const adjusted = triggered.map((r) => {
    if (hasRegimeShift && (r.type === "spread_anomaly" || r.type === "basis_shift")) {
      const dampFactor = r.type === "spread_anomaly" ? 0.7 : 0.75;
      return {
        ...r,
        result: {
          ...r.result,
          confidence: r.result.confidence * dampFactor,
          riskItems: [
            ...r.result.riskItems,
            `⚠ Regime 变化与${r.type === "spread_anomaly" ? "价差异常" : "基差变动"}同时触发，历史统计关系可能失效`,
          ],
        },
      };
    }
    return r;
  });

  // ── Resonance: ≥2 signals → boost confidence ──
  const resonanceBoost = triggered.length >= 2 ? 1.2 : 1.0;

  const finalAlerts = adjusted.map((r) => ({
    ...r,
    result: {
      ...r.result,
      confidence: Math.min(0.95, r.result.confidence * resonanceBoost),
    },
  }));

  // ── Suppress low-confidence signals when stronger ones exist ──
  const output: EvaluatorResult[] = [];
  const maxConfidence = Math.max(...finalAlerts.map((r) => r.result.confidence));

  for (const alert of finalAlerts) {
    // Suppress if confidence is less than 40% of the strongest signal
    if (alert.result.confidence < maxConfidence * 0.4 && finalAlerts.length > 1) {
      suppressed.push({
        type: alert.type,
        reason: `置信度 ${(alert.result.confidence * 100).toFixed(0)}% 远低于最强信号 ${(maxConfidence * 100).toFixed(0)}%`,
      });
    } else {
      output.push(alert);
    }
  }

  // ── Ensemble confidence: weighted average ──
  let weightedSum = 0;
  let weightTotal = 0;
  for (const alert of output) {
    const w = SIGNAL_WEIGHTS[alert.type] ?? 0.5;
    weightedSum += alert.result.confidence * w;
    weightTotal += w;
  }
  const ensembleConfidence = weightTotal > 0 ? weightedSum / weightTotal : 0;

  return {
    alerts: output,
    suppressed,
    signalCount: triggered.length,
    ensembleConfidence,
  };
}
