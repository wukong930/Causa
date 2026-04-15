import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep } from "./base";

/**
 * Inventory Shock Detector (Simplified)
 *
 * Placeholder implementation for Phase 3.
 * Full implementation in Phase 4 with inventory data integration.
 */
export class InventoryShockDetector implements TriggerEvaluator {
  type = "inventory_shock" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    // Simplified: always return null (no trigger)
    // In Phase 4, integrate with inventory data sources
    return null;
  }
}
