import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep } from "./base";

/**
 * Event Driven Detector (Simplified)
 *
 * Placeholder implementation for Phase 3.
 * Full implementation in Phase 4 with external event data integration.
 */
export class EventDrivenDetector implements TriggerEvaluator {
  type = "event_driven" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    // Simplified: always return null (no trigger)
    // In Phase 4, integrate with external event sources
    return null;
  }
}
