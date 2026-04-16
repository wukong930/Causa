import type { Hypothesis } from "@/types/domain";
import { getActiveLLMProvider } from "@/lib/llm/registry";
import { hypothesisEvolutionPrompt } from "@/lib/llm/prompts";

/**
 * Evolve a hypothesis based on execution feedback and current market.
 */
export async function evolveHypothesis(
  hypothesis: Hypothesis,
  feedback: string,
  currentMarket: string
): Promise<Partial<Hypothesis>> {
  const llm = await getActiveLLMProvider();

  const messages = hypothesisEvolutionPrompt({
    hypothesis: JSON.stringify(hypothesis, null, 2),
    executionFeedback: feedback || "暂无执行反馈",
    currentMarket: currentMarket || "暂无市场数据",
  });

  const result = await llm.complete({
    messages,
    temperature: 0.7,
    maxTokens: 2048,
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(result.content);
    return {
      ...parsed,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    console.error("Failed to parse evolution result:", result.content);
    return { lastUpdated: new Date().toISOString() };
  }
}
