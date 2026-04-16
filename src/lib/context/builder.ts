import { fetchGDELTEvents, type GDELTEvent } from "./gdelt";
import { fetchMacroIndicators, type MacroSnapshot } from "./macro";
import { compressToContextVector, type ContextVector } from "./compress";
import { getCurrentRegime } from "@/lib/memory/regime-store";
import { storeRegime } from "@/lib/memory/regime-store";
import { db } from "@/db";
import { marketData } from "@/db/schema";
import { desc } from "drizzle-orm";

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

  // Fetch market returns for statistical regime detection
  let marketReturns: number[] | undefined;
  try {
    const recentData = await db
      .select({ close: marketData.close })
      .from(marketData)
      .orderBy(desc(marketData.timestamp))
      .limit(120);
    if (recentData.length >= 20) {
      const closes = recentData.map((d) => d.close).reverse(); // time-ascending
      marketReturns = [];
      for (let i = 1; i < closes.length; i++) {
        marketReturns.push(Math.log(closes[i] / closes[i - 1]));
      }
    }
  } catch { /* market data unavailable, proceed without */ }

  // Compress to context vector
  const contextVector = await compressToContextVector(events, macro, marketReturns);

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
