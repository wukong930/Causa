import type { Alert, Hypothesis } from "@/types/domain";
import { generateHypotheses } from "./generate";
import { validateHypothesis, type ValidationResult } from "./validate";
import { selectTopHypotheses } from "./select";
import { summarizeEvolutionCycle } from "./summarize";
import { storeHypothesis } from "@/lib/memory/hypothesis-store";

export interface EvolutionCycleResult {
  selected: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>;
  rejected: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>;
  summary: string;
  stats: {
    totalGenerated: number;
    totalSelected: number;
    avgScore: number;
  };
}

/**
 * Run one full evolution cycle: Generate → Validate → Select → Summarize → Store
 */
export async function runEvolutionCycle(
  alerts: Alert[],
  context: {
    contextVector?: string;
    relatedMemory?: string;
    existingPositions?: string;
  },
  options: { topN?: number } = {}
): Promise<EvolutionCycleResult> {
  const topN = options.topN ?? 5;

  // 1. Generate hypotheses from all alerts
  const allCandidates: Array<{ hypothesis: Hypothesis; validation: ValidationResult }> = [];

  for (const alert of alerts) {
    const hypotheses = await generateHypotheses(alert, {
      alertSummary: `[${alert.severity}] ${alert.title}\n${alert.summary}`,
      contextVector: context.contextVector ?? "",
      relatedMemory: context.relatedMemory ?? "",
      existingPositions: context.existingPositions ?? "",
    });

    // 2. Validate hypotheses in parallel
    const validations = await Promise.all(hypotheses.map((h) => validateHypothesis(h)));
    for (let i = 0; i < hypotheses.length; i++) {
      allCandidates.push({ hypothesis: hypotheses[i], validation: validations[i] });
    }
  }

  // 3. Select top N
  const selected = selectTopHypotheses(allCandidates, topN);
  const selectedIds = new Set(selected.map((s) => s.hypothesis.id));
  const rejected = allCandidates.filter((c) => !selectedIds.has(c.hypothesis.id));

  const avgScore =
    allCandidates.length > 0
      ? allCandidates.reduce((s, c) => s + c.validation.totalScore, 0) / allCandidates.length
      : 0;

  const stats = {
    totalGenerated: allCandidates.length,
    totalSelected: selected.length,
    avgScore,
  };

  // 4. Summarize
  let summary = "";
  try {
    summary = await summarizeEvolutionCycle(selected, rejected, stats);
  } catch (err) {
    console.error("Failed to summarize evolution cycle:", err);
    summary = `本轮生成 ${stats.totalGenerated} 个假设，保留 ${stats.totalSelected} 个`;
  }

  // 5. Store selected hypotheses to memory
  for (const s of selected) {
    try {
      await storeHypothesis({
        hypothesisText: s.hypothesis.hypothesisText,
        hypothesisType: s.hypothesis.type,
        spreadModel: s.hypothesis.type === "spread" ? s.hypothesis.spreadModel : undefined,
        assets: s.hypothesis.type === "spread"
          ? s.hypothesis.legs.map((l) => l.asset)
          : [s.hypothesis.leg.asset],
        outcome: "pending",
        validationScore: s.validation.totalScore,
        confidence: s.hypothesis.type === "spread"
          ? (s.hypothesis.causalConfidence ?? 0)
          : (s.hypothesis.confidence ?? 0),
        alertId: s.hypothesis.createdFromAlertId,
        createdAt: s.hypothesis.createdAt,
      });
    } catch (err) {
      console.error("Failed to store hypothesis to memory:", err);
    }
  }

  return { selected, rejected, summary, stats };
}
