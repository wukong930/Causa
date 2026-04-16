import type { Hypothesis } from "@/types/domain";
import type { ValidationResult } from "./validate";

/**
 * Select top hypotheses by validation score.
 */
export function selectTopHypotheses(
  candidates: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>,
  limit: number = 5
): Array<{ hypothesis: Hypothesis; validation: ValidationResult }> {
  return [...candidates]
    .sort((a, b) => b.validation.totalScore - a.validation.totalScore)
    .slice(0, limit);
}
