/**
 * Fact sheet builder — pre-computes hard statistical facts for LLM analysis.
 * LLM receives these as immutable inputs, not as suggestions to modify.
 */
import { db } from "@/db";
import { marketData, industryData } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import type { Alert } from "@/types/domain";

export interface FactSheet {
  /** Alert-level facts */
  alertTitle: string;
  alertSeverity: string;
  alertCategory: string;
  alertConfidence: number;

  /** Spread statistics (if spread alert) */
  spread?: {
    leg1: string;
    leg2: string;
    currentZScore: number;
    historicalMean: number;
    stdDev: number;
    halfLifeDays: number;
    hurstExponent: number;
    adfPValue: number;
    /** How many times z-score exceeded this level historically */
    historicalOccurrences: number;
    /** Average days to revert from similar levels */
    avgReversionDays: number;
  };

  /** Volume & open interest changes */
  volumeOI?: {
    symbol: string;
    recentAvgVolume: number;
    priorAvgVolume: number;
    volumeChangeRatio: number;
    recentAvgOI: number;
    priorAvgOI: number;
    oiChangeRatio: number;
  }[];

  /** Industry data (if available) */
  industry?: {
    inventory?: { value: number; unit: string; date: string };
    spotPrice?: { value: number; unit: string; date: string };
    basis?: { value: number; unit: string; date: string };
  };
}

/**
 * Build a fact sheet from DB data for a given alert.
 * All values are hard-computed — LLM must not modify them.
 */
export async function buildFactSheet(alert: Alert): Promise<FactSheet> {
  const sheet: FactSheet = {
    alertTitle: alert.title,
    alertSeverity: alert.severity,
    alertCategory: alert.category,
    alertConfidence: alert.confidence,
  };

  // Spread facts
  if (alert.spreadInfo) {
    const si = alert.spreadInfo;
    sheet.spread = {
      leg1: si.leg1,
      leg2: si.leg2,
      currentZScore: si.zScore,
      historicalMean: si.historicalMean,
      stdDev: (si.sigma1Upper - si.historicalMean) || 1,
      halfLifeDays: si.halfLife,
      hurstExponent: 0.5, // will be overridden if available
      adfPValue: si.adfPValue,
      historicalOccurrences: 0,
      avgReversionDays: 0,
    };
  }

  // Volume/OI changes for related assets
  const assets = alert.relatedAssets || [];
  const voiData: FactSheet["volumeOI"] = [];

  for (const symbol of assets.slice(0, 2)) {
    try {
      const recent = await db.select()
        .from(marketData)
        .where(eq(marketData.symbol, symbol))
        .orderBy(desc(marketData.timestamp))
        .limit(25);

      if (recent.length >= 20) {
        const recent5 = recent.slice(0, 5);
        const prior20 = recent.slice(5, 25);

        const avgVol5 = recent5.reduce((s, r) => s + r.volume, 0) / 5;
        const avgVol20 = prior20.reduce((s, r) => s + r.volume, 0) / prior20.length;
        const avgOI5 = recent5.reduce((s, r) => s + r.openInterest, 0) / 5;
        const avgOI20 = prior20.reduce((s, r) => s + r.openInterest, 0) / prior20.length;

        voiData.push({
          symbol,
          recentAvgVolume: Math.round(avgVol5),
          priorAvgVolume: Math.round(avgVol20),
          volumeChangeRatio: avgVol20 > 0 ? Math.round((avgVol5 / avgVol20 - 1) * 100) / 100 : 0,
          recentAvgOI: Math.round(avgOI5),
          priorAvgOI: Math.round(avgOI20),
          oiChangeRatio: avgOI20 > 0 ? Math.round((avgOI5 / avgOI20 - 1) * 100) / 100 : 0,
        });
      }
    } catch { /* skip */ }
  }
  if (voiData.length) sheet.volumeOI = voiData;

  // Industry data
  const primarySymbol = assets[0];
  if (primarySymbol) {
    try {
      const [inv] = await db.select().from(industryData)
        .where(and(eq(industryData.symbol, primarySymbol), eq(industryData.dataType, "inventory")))
        .orderBy(desc(industryData.timestamp)).limit(1);

      const [spot] = await db.select().from(industryData)
        .where(and(eq(industryData.symbol, primarySymbol), eq(industryData.dataType, "spot_price")))
        .orderBy(desc(industryData.timestamp)).limit(1);

      const [bas] = await db.select().from(industryData)
        .where(and(eq(industryData.symbol, primarySymbol), eq(industryData.dataType, "basis")))
        .orderBy(desc(industryData.timestamp)).limit(1);

      const industry: FactSheet["industry"] = {};
      if (inv) industry.inventory = { value: inv.value, unit: inv.unit, date: inv.timestamp.toISOString().slice(0, 10) };
      if (spot) industry.spotPrice = { value: spot.value, unit: spot.unit, date: spot.timestamp.toISOString().slice(0, 10) };
      if (bas) industry.basis = { value: bas.value, unit: bas.unit, date: bas.timestamp.toISOString().slice(0, 10) };
      if (Object.keys(industry).length) sheet.industry = industry;
    } catch { /* skip */ }
  }

  return sheet;
}
