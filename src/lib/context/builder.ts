import { fetchGDELTEvents, type GDELTEvent } from "./gdelt";
import { fetchMacroIndicators, type MacroSnapshot } from "./macro";
import { compressToContextVector, type ContextVector } from "./compress";
import { getCurrentRegime } from "@/lib/memory/regime-store";
import { storeRegime } from "@/lib/memory/regime-store";

export interface FullContext {
  events: GDELTEvent[];
  macro: MacroSnapshot;
  contextVector: ContextVector;
  currentRegime: string | null;
}

/**
 * Build full context: fetch events + macro → compress → store regime.
 */
export async function buildFullContext(): Promise<FullContext> {
  // Fetch data in parallel — tolerate individual failures
  const [eventsResult, macroResult] = await Promise.allSettled([
    fetchGDELTEvents(),
    fetchMacroIndicators(),
  ]);

  const events: GDELTEvent[] = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const macro: MacroSnapshot = macroResult.status === "fulfilled"
    ? macroResult.value
    : { fetchedAt: new Date().toISOString(), source: "fallback" };

  // Compress to context vector
  const contextVector = await compressToContextVector(events, macro);

  // Store regime to memory
  try {
    await storeRegime({
      regimeLabel: contextVector.macroRegime,
      macroRegime: contextVector.macroRegime,
      liquidity: contextVector.liquidity,
      usd: contextVector.usd,
      commodityClusters: contextVector.commodityClusters,
      keyEvents: contextVector.keyEvents,
      confidence: contextVector.regimeConfidence,
      snapshotAt: contextVector.generatedAt,
    });
  } catch (err) {
    console.error("Failed to store regime:", err);
  }

  // Get current regime label
  let currentRegime: string | null = null;
  try {
    const regime = await getCurrentRegime();
    currentRegime = regime?.regimeLabel ?? null;
  } catch { /* ignore */ }

  return { events, macro, contextVector, currentRegime };
}
