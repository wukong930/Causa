import type { AlertType } from "@/types/domain";
import type { TriggerEvaluator } from "./base";
import { SpreadAnomalyDetector } from "./spread-anomaly";
import { BasisShiftDetector } from "./basis-shift";
import { MomentumDetector } from "./momentum";
import { EventDrivenDetector } from "./event-driven";
import { InventoryShockDetector } from "./inventory-shock";
import { RegimeShiftDetector } from "./regime-shift";

type TriggerAlertType = Exclude<AlertType, "propagation">;

/**
 * Registry of all trigger evaluators
 */
export const TRIGGER_EVALUATORS: Record<TriggerAlertType, TriggerEvaluator> = {
  spread_anomaly: new SpreadAnomalyDetector(),
  basis_shift: new BasisShiftDetector(),
  momentum: new MomentumDetector(),
  event_driven: new EventDrivenDetector(),
  inventory_shock: new InventoryShockDetector(),
  regime_shift: new RegimeShiftDetector(),
};

/**
 * Get evaluator by alert type (returns undefined for propagation)
 */
export function getEvaluator(type: AlertType): TriggerEvaluator | undefined {
  return (TRIGGER_EVALUATORS as Partial<Record<AlertType, TriggerEvaluator>>)[type];
}

/**
 * Get all evaluators
 */
export function getAllEvaluators(): TriggerEvaluator[] {
  return Object.values(TRIGGER_EVALUATORS);
}

/**
 * Get evaluators for specific types
 */
export function getEvaluators(types: AlertType[]): TriggerEvaluator[] {
  return types
    .map((type) => (TRIGGER_EVALUATORS as Partial<Record<AlertType, TriggerEvaluator>>)[type])
    .filter((e): e is TriggerEvaluator => e != null);
}
