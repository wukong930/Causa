import { getActiveLLMProvider } from "@/lib/llm/registry";
import { validationSummaryPrompt } from "@/lib/llm/prompts";
import type { Hypothesis } from "@/types/domain";
import type { ValidationResult } from "./validate";

/**
 * Summarize an evolution cycle using LLM.
 */
export async function summarizeEvolutionCycle(
  selected: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>,
  rejected: Array<{ hypothesis: Hypothesis; validation: ValidationResult }>,
  stats: { totalGenerated: number; totalSelected: number; avgScore: number }
): Promise<string> {
  const llm = await getActiveLLMProvider();

  const selectedText = selected
    .map((s) => `- [${s.validation.totalScore}分] ${s.hypothesis.hypothesisText} (${s.validation.details})`)
    .join("\n");

  const rejectedText = rejected
    .slice(0, 5) // Only show top 5 rejected
    .map((r) => `- [${r.validation.totalScore}分] ${r.hypothesis.hypothesisText} (${r.validation.details})`)
    .join("\n");

  const messages = validationSummaryPrompt({
    selectedHypotheses: selectedText || "无",
    rejectedHypotheses: rejectedText || "无",
    cycleStats: `生成 ${stats.totalGenerated} 个假设，保留 ${stats.totalSelected} 个，平均分 ${stats.avgScore.toFixed(1)}`,
  });

  const result = await llm.complete({
    messages,
    temperature: 0.5,
    maxTokens: 512,
  });

  return result.content;
}
