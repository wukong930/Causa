import type { MacroSnapshot } from "./macro";

const SYMBOL_MAP: Record<string, keyof MacroSnapshot> = {
  "BZ=F": "crudeBrent",
  "GC=F": "goldSpot",
  "HG=F": "copperLME",
  "TIO=F": "ironOre62Fe",
};

/**
 * Fetch commodity spot/futures prices from Yahoo Finance v8 chart API.
 * Free, no API key required. Returns delayed quotes.
 */
export async function fetchCommodityPrices(): Promise<Partial<MacroSnapshot>> {
  const result: Partial<MacroSnapshot> = {};

  for (const [symbol, field] of Object.entries(SYMBOL_MAP)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number" && isFinite(price)) {
        (result as Record<string, number>)[field] = price;
      }
    } catch {
      // Skip failed symbol
    }
  }

  return result;
}
