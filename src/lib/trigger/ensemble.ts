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
import type { AlertType, AlertCategory } from "@/types/domain";
import type { TriggerResult } from "./base";
import { getSignalHitRates, type SignalHitRate } from "./signal-quality";

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
  regime_shift: 0.5,
  inventory_shock: 0.75,
  event_driven: 0.6,
};

/**
 * Run ensemble logic on collected trigger results.
 * Call this instead of creating alerts per-evaluator.
 */
export function ensembleSignals(
  results: EvaluatorResult[],
  hitRates?: SignalHitRate[]
): EnsembleOutput {
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
  if (finalAlerts.length === 0) {
    return { alerts: [], suppressed, signalCount: triggered.length, ensembleConfidence: 0 };
  }
  const maxConfidence = Math.max(...finalAlerts.map((r) => r.result.confidence));

  for (const alert of finalAlerts) {
    // Suppress if confidence is less than 40% of the strongest signal
    if (alert.result.confidence < maxConfidence * 0.4 && finalAlerts.length > 1) {
      suppressed.push({
        type: alert.type,
        reason: `置信度 ${(alert.result.confidence * 100).toFixed(0)}% 远低于最强信号 ${(maxConfidence * 100).toFixed(0)}%`,
      });
    // Single-signal minimum confidence: 0.65 (0.55 for event_driven)
    } else if (finalAlerts.length === 1 && alert.result.confidence < (alert.type === "event_driven" ? 0.55 : 0.65)) {
      suppressed.push({
        type: alert.type,
        reason: `单信号置信度 ${(alert.result.confidence * 100).toFixed(0)}% 低于阈值 ${alert.type === "event_driven" ? 55 : 65}%`,
      });
    // regime_shift cannot trigger alone — must resonate with other signal types
    } else if (alert.type === "regime_shift" && types.size === 1) {
      suppressed.push({
        type: alert.type,
        reason: `regime_shift 单独触发，需与其他信号共振`,
      });
    } else {
      output.push(alert);
    }
  }

  // ── Ensemble confidence: weighted average with historical hit rates ──
  const hitRateMap = new Map(
    (hitRates ?? []).map((hr) => [hr.signalType, hr])
  );
  let weightedSum = 0;
  let weightTotal = 0;
  for (const alert of output) {
    const w = SIGNAL_WEIGHTS[alert.type] ?? 0.5;
    // Adjust weight by historical hit rate if available (min 5 samples)
    const hr = hitRateMap.get(alert.type);
    const hitRateMultiplier = hr && hr.totalCount >= 5
      ? 0.5 + hr.hitRate  // range [0.5, 1.5] — bad track record halves weight, good doubles
      : 1.0;
    const adjustedW = w * hitRateMultiplier;
    weightedSum += alert.result.confidence * adjustedW;
    weightTotal += adjustedW;
  }
  const ensembleConfidence = weightTotal > 0 ? weightedSum / weightTotal : 0;

  return {
    alerts: output,
    suppressed,
    signalCount: triggered.length,
    ensembleConfidence,
  };
}
