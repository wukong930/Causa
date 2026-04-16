import type { Alert, Hypothesis, SpreadHypothesis, DirectionalHypothesis, SpreadModel } from "@/types/domain";
import { getActiveLLMProvider } from "@/lib/llm/registry";
import { hypothesisGenerationPrompt } from "@/lib/llm/prompts";
import { generateHypothesisId, createSpreadHypothesis, createDirectionalHypothesis } from "@/lib/hypothesis";

interface GenerateContext {
  alertSummary: string;
  contextVector: string;
  relatedMemory: string;
  existingPositions: string;
}

/**
 * Generate candidate hypotheses from an alert using LLM.
 */
export async function generateHypotheses(
  alert: Alert,
  context: GenerateContext
): Promise<Hypothesis[]> {
  const llm = await getActiveLLMProvider();

  const messages = hypothesisGenerationPrompt({
    alertSummary: `[${alert.severity}] ${alert.title}\n${alert.summary}\n资产: ${alert.relatedAssets.join(", ")}`,
    contextVector: context.contextVector || "暂无上下文数据",
    relatedMemory: context.relatedMemory || "暂无历史记忆",
    existingPositions: context.existingPositions || "暂无持仓",
  });

  const result = await llm.complete({
    messages,
    temperature: 0.8,
    maxTokens: 4096,
    jsonMode: true,
  });

  // Parse LLM response
  let rawHypotheses: Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(result.content);
    rawHypotheses = Array.isArray(parsed) ? parsed : parsed.hypotheses ?? [parsed];
  } catch {
    console.error("Failed to parse LLM hypothesis response:", result.content);
    return [];
  }

  const now = new Date().toISOString();
  const hypotheses: Hypothesis[] = [];

  for (const raw of rawHypotheses) {
    try {
      if (raw.type === "spread") {
        const h = createSpreadHypothesis({
          spreadModel: (raw.spreadModel as SpreadModel) || "calendar_spread",
          legs: (raw.legs as SpreadHypothesis["legs"]) || [],
          entryThreshold: Number(raw.entryThreshold) || 2.0,
          exitThreshold: Number(raw.exitThreshold) || 0.5,
          stopLossThreshold: Number(raw.stopLossThreshold) || 3.5,
          currentZScore: alert.spreadInfo?.zScore ?? 0,
          halfLife: alert.spreadInfo?.halfLife ?? 10,
          adfPValue: alert.spreadInfo?.adfPValue ?? 0.05,
          hypothesisText: String(raw.hypothesisText || ""),
          triggerDescription: alert.summary,
          createdFromAlertId: alert.id,
          category: alert.category,
        });
        hypotheses.push(h);
      } else {
        const leg = (raw.legs as DirectionalHypothesis["leg"][])?.at(0) ?? {
          asset: alert.relatedAssets[0] ?? "",
          direction: "long" as const,
          exchange: "SHFE",
        };
        const h = createDirectionalHypothesis({
          leg,
          hypothesisText: String(raw.hypothesisText || ""),
          triggerDescription: alert.summary,
          createdFromAlertId: alert.id,
          confidence: Number(raw.confidence) || 0.5,
          category: alert.category,
        });
        hypotheses.push(h);
      }
    } catch (err) {
      console.error("Failed to create hypothesis from LLM output:", err);
    }
  }

  return hypotheses;
}
