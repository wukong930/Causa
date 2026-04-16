import { getActiveLLMProvider } from "@/lib/llm/registry";
import { contextCompressionPrompt } from "@/lib/llm/prompts";
import type { GDELTEvent } from "./gdelt";
import type { MacroSnapshot } from "./macro";

export interface ContextVector {
  macroRegime: "inflation_up" | "inflation_down" | "growth_up" | "growth_down" | "stagflation" | "goldilocks";
  liquidity: "easing" | "neutral" | "tightening";
  usd: "strong" | "neutral" | "weak";
  commodityClusters: Record<string, string>;
  keyEvents: string[];
  regimeConfidence: number;
  generatedAt: string;
}

/**
 * Compress GDELT events + macro indicators into a structured context vector using LLM.
 */
export async function compressToContextVector(
  events: GDELTEvent[],
  macro: MacroSnapshot
): Promise<ContextVector> {
  const llm = await getActiveLLMProvider();

  const eventsText = events
    .slice(0, 15)
    .map((e) => `- [${e.publishedAt}] ${e.title} (${e.source}, tone: ${e.tone.toFixed(1)})`)
    .join("\n");

  const macroText = Object.entries(macro)
    .filter(([k]) => k !== "fetchedAt" && k !== "source")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const messages = contextCompressionPrompt({
    gdeltEvents: eventsText || "暂无事件数据",
    macroIndicators: macroText || "暂无宏观数据",
  });

  const result = await llm.complete({
    messages,
    temperature: 0.3,
    maxTokens: 1024,
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(result.content);
    return {
      macroRegime: parsed.macro_regime ?? "goldilocks",
      liquidity: parsed.liquidity ?? "neutral",
      usd: parsed.usd ?? "neutral",
      commodityClusters: parsed.commodity_clusters ?? {},
      keyEvents: parsed.key_events ?? [],
      regimeConfidence: parsed.regime_confidence ?? 0.5,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      macroRegime: "goldilocks",
      liquidity: "neutral",
      usd: "neutral",
      commodityClusters: {},
      keyEvents: [],
      regimeConfidence: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
