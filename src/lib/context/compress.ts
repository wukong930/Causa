import { getActiveLLMProvider } from "@/lib/llm/registry";
import { contextCompressionPrompt } from "@/lib/llm/prompts";
import type { GDELTEvent } from "./gdelt";
import type { MacroSnapshot } from "./macro";
import { detectVolRegime, type VolRegimeResult } from "@/lib/stats/regime";

export interface ContextVector {
  macroRegime: "inflation_up" | "inflation_down" | "growth_up" | "growth_down" | "stagflation" | "goldilocks";
  liquidity: "easing" | "neutral" | "tightening";
  usd: "strong" | "neutral" | "weak";
  commodityClusters: Record<string, string>;
  keyEvents: string[];
  regimeConfidence: number;
  generatedAt: string;
  /** Statistical regime signal for cross-validation */
  statVolRegime?: VolRegimeResult;
}

/**
 * Compress GDELT events + macro indicators into a structured context vector using LLM.
 * Optionally includes statistical regime signals for cross-validation.
 */
export async function compressToContextVector(
  events: GDELTEvent[],
  macro: MacroSnapshot,
  marketReturns?: number[]
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

  // Statistical regime detection (if market returns available)
  let statVolRegime: VolRegimeResult | undefined;
  let statisticalRegime: string | undefined;
  if (marketReturns && marketReturns.length >= 10) {
    statVolRegime = detectVolRegime(marketReturns);
    statisticalRegime = `波动率 Regime: ${statVolRegime.current}（短期/长期 EWMA 比 ${statVolRegime.ratio.toFixed(2)}，置信度 ${(statVolRegime.confidence * 100).toFixed(0)}%）`;
  }

  const messages = contextCompressionPrompt({
    gdeltEvents: eventsText || "暂无事件数据",
    macroIndicators: macroText || "暂无宏观数据",
    statisticalRegime,
  });

  const result = await llm.complete({
    messages,
    temperature: 0.3,
    maxTokens: 1024,
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(result.content);
    let regimeConfidence = parsed.regime_confidence ?? 0.5;

    // Cross-validation: adjust confidence based on stat/LLM agreement
    if (statVolRegime && statVolRegime.current !== "normal") {
      const llmSaysVolatile = parsed.commodity_clusters &&
        Object.values(parsed.commodity_clusters).some((v: unknown) =>
          typeof v === "string" && (v.includes("constrained") || v.includes("weak"))
        );
      const statSaysHigh = statVolRegime.current === "high";

      if ((statSaysHigh && llmSaysVolatile) || (!statSaysHigh && !llmSaysVolatile)) {
        regimeConfidence = Math.min(1, regimeConfidence * 1.3);
      } else {
        regimeConfidence = regimeConfidence * 0.7;
      }
    }

    return {
      macroRegime: parsed.macro_regime ?? "goldilocks",
      liquidity: parsed.liquidity ?? "neutral",
      usd: parsed.usd ?? "neutral",
      commodityClusters: parsed.commodity_clusters ?? {},
      keyEvents: parsed.key_events ?? [],
      regimeConfidence,
      generatedAt: new Date().toISOString(),
      statVolRegime,
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
      statVolRegime,
    };
  }
}
