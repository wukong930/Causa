import { fetchCommodityPrices } from "./yahoo";
import { fetchCN10YYield } from "./cn-bond";

export interface MacroSnapshot {
  usdIndex?: number;
  cpiYoY?: number;
  pmiManufacturing?: number;
  fedFundsRate?: number;
  us10yYield?: number;
  cn10yYield?: number;
  crudeBrent?: number;
  goldSpot?: number;
  copperLME?: number;
  ironOre62Fe?: number;
  balticDryIndex?: number;
  fetchedAt: string;
  source: string;
}

const FRED_SERIES: Record<string, string> = {
  fedFundsRate: "FEDFUNDS",
  us10yYield: "DGS10",
  cpiYoY: "CPIAUCSL",
  pmiManufacturing: "MANEMP",
  usdIndex: "DTWEXBGS",
  balticDryIndex: "DBDI",
};

async function fetchFredSeries(apiKey: string): Promise<Partial<MacroSnapshot>> {
  const result: Partial<MacroSnapshot> = {};

  for (const [key, seriesId] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const data = await res.json();
        const value = data.observations?.[0]?.value;
        if (value && value !== ".") {
          (result as Record<string, number>)[key] = parseFloat(value);
        }
      }
    } catch {
      // Skip failed series
    }
  }

  return result;
}

/**
 * Fetch macro indicators from multiple free sources in parallel.
 * FRED (requires API key) + Yahoo Finance + China Bond (no key needed).
 */
export async function fetchMacroIndicators(): Promise<MacroSnapshot> {
  const fredApiKey = process.env.FRED_API_KEY;
  const sources: string[] = [];

  const [fredResult, yahooResult, cnBondResult] = await Promise.allSettled([
    fredApiKey ? fetchFredSeries(fredApiKey) : Promise.resolve({}),
    fetchCommodityPrices(),
    fetchCN10YYield(),
  ]);

  const snapshot: MacroSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "static_fallback",
  };

  // Merge FRED data
  if (fredResult.status === "fulfilled" && Object.keys(fredResult.value).length > 0) {
    Object.assign(snapshot, fredResult.value);
    sources.push("fred");
  }

  // Merge Yahoo commodity prices
  if (yahooResult.status === "fulfilled" && Object.keys(yahooResult.value).length > 0) {
    Object.assign(snapshot, yahooResult.value);
    sources.push("yahoo");
  }

  // Merge CN 10Y yield
  if (cnBondResult.status === "fulfilled" && cnBondResult.value != null) {
    snapshot.cn10yYield = cnBondResult.value;
    sources.push("chinabond");
  }

  snapshot.source = sources.length > 0 ? sources.join("+") : "static_fallback";
  return snapshot;
}
