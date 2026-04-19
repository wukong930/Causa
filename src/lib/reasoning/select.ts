import type { Hypothesis } from "@/types/domain";
import type { ValidationResult } from "./validate";

/**
 * Extract a dedup key from hypothesis legs.
 * Same asset pair (regardless of order) → same key.
 */
function getLegKey(hyp: Hypothesis): string {
  const assets =
    hyp.type === "spread"
      ? hyp.legs.map((l) => l.asset).sort()
      : [hyp.leg.asset];
  return assets.join("|");
}

/**
 * Select top hypotheses by validation score.
 * Deduplicates by asset pair — keeps only the highest-scoring hypothesis per pair.
 */
export function selectTopHypotheses(
  candidates: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>,
  limit: number = 5
): Array<{ hypothesis: Hypothesis; validation: ValidationResult }> {
  // Sort by score descending
  const sorted = [...candidates].sort((a, b) => b.validation.totalScore - a.validation.totalScore);

  // Deduplicate: first occurrence of each leg key wins (highest score)
  const seen = new Set<string>();
  const deduped: typeof sorted = [];
  for (const item of sorted) {
    const key = getLegKey(item.hypothesis);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.slice(0, limit);
}
