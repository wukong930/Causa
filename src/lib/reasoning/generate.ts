import type { Alert, Hypothesis, SpreadHypothesis, DirectionalHypothesis, SpreadModel } from "@/types/domain";
import { getActiveLLMProvider } from "@/lib/llm/registry";
import { hypothesisGenerationPrompt } from "@/lib/llm/prompts";
import { generateHypothesisId, createSpreadHypothesis, createDirectionalHypothesis } from "@/lib/hypothesis";
import { buildFactSheet } from "@/lib/reasoning/fact-sheet";

interface GenerateContext {
  alertSummary: string;
  contextVector: string;
  relatedMemory: string;
  existingPositions: string;
}

/**
 * Generate candidate hypotheses from an alert using LLM.
 * LLM acts as analyst: explains anomalies and assesses risk.
 * Trading parameters come from statistical models, not LLM.
 */
export async function generateHypotheses(
  alert: Alert,
  context: GenerateContext
): Promise<Hypothesis[]> {
  const llm = await getActiveLLMProvider();

  // Build fact sheet with hard data for LLM context
  let factSheetStr = "";
  try {
    const factSheet = await buildFactSheet(alert);
    factSheetStr = JSON.stringify(factSheet, null, 2);
  } catch {
    factSheetStr = "统计事实构建失败";
  }

  const messages = hypothesisGenerationPrompt({
    alertSummary: `[${alert.severity}] ${alert.title}\n${alert.summary}\n资产: ${alert.relatedAssets.join(", ")}`,
    contextVector: context.contextVector || "暂无上下文数据",
    relatedMemory: context.relatedMemory || "暂无历史记忆",
    existingPositions: context.existingPositions || "暂无持仓",
    factSheet: factSheetStr,
  });

  const result = await llm.complete({
    messages,
    temperature: 0.4,
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
      // Build rich hypothesis text from LLM analysis fields
      const parts: string[] = [];
      if (raw.hypothesisText) parts.push(String(raw.hypothesisText));
      if (raw.analysis) parts.push(`【原因分析】${raw.analysis}`);
      if (raw.historicalComparison) parts.push(`【历史对比】${raw.historicalComparison}`);
      if (raw.riskFactors) parts.push(`【回归阻碍】${raw.riskFactors}`);
      const analysisText = parts.join("\n");

      // Collect risk items from LLM
      const riskItems = Array.isArray(raw.riskItems) ? raw.riskItems.map(String) : [];

      if (raw.type === "spread") {
        // Trading parameters come from alert statistics, NOT from LLM
        const zScore = Math.abs(alert.spreadInfo?.zScore ?? 0);
        const h = createSpreadHypothesis({
          spreadModel: (raw.spreadModel as SpreadModel) || "calendar_spread",
          legs: (raw.legs as SpreadHypothesis["legs"]) || [],
          entryThreshold: Math.max(zScore * 0.9, 1.5),   // statistical: ~90% of current z
          exitThreshold: 0.5,                              // statistical default
          stopLossThreshold: Math.max(zScore * 1.3, 3.0), // statistical: 130% of current z
          currentZScore: alert.spreadInfo?.zScore ?? 0,
          halfLife: alert.spreadInfo?.halfLife ?? 10,
          adfPValue: alert.spreadInfo?.adfPValue ?? 0.05,
          hypothesisText: analysisText,
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
          hypothesisText: analysisText,
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
