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

/**
 * Fetch macro indicators from public APIs.
 * Uses FRED (Federal Reserve Economic Data) as primary source.
 * Falls back to static snapshot if API is unavailable.
 */
export async function fetchMacroIndicators(): Promise<MacroSnapshot> {
  const fredApiKey = process.env.FRED_API_KEY;
  const snapshot: MacroSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "static_fallback",
  };

  if (!fredApiKey) {
    // Return a reasonable static fallback
    return {
      ...snapshot,
      source: "static_fallback",
    };
  }

  // Fetch key series from FRED
  const series: Record<string, string> = {
    fedFundsRate: "FEDFUNDS",
    us10yYield: "DGS10",
    cpiYoY: "CPIAUCSL",
    pmiManufacturing: "MANEMP",
  };

  for (const [key, seriesId] of Object.entries(series)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        const value = data.observations?.[0]?.value;
        if (value && value !== ".") {
          (snapshot as unknown as Record<string, unknown>)[key] = parseFloat(value);
        }
      }
    } catch {
      // Skip failed series
    }
  }

  snapshot.source = "fred";
  return snapshot;
}
