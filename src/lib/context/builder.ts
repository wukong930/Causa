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
  // Fetch data in parallel
  const [events, macro] = await Promise.all([
    fetchGDELTEvents(),
    fetchMacroIndicators(),
  ]);

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
