/**
 * Outcome tracker — evaluates recommendation performance after issuance.
 * Runs daily to check if spread reached target/stop or expired.
 */

import { db } from "@/db";
import { recommendations as recsTable, marketData } from "@/db/schema";
import { eq, and, gte, desc, or } from "drizzle-orm";
import { serializeRecords } from "@/lib/serialize";

export interface OutcomeResult {
  recommendationId: string;
  assets: string[];
  daysElapsed: number;
  spreadAtEntry: number;
  spreadNow: number;
  targetSpread: number;
  stopSpread: number;
  maxFavorable: number;
  maxAdverse: number;
  outcome: "win" | "loss" | "open" | "expired";
}

export async function trackOutcomes(): Promise<OutcomeResult[]> {
  // Fetch active recommendations that have legs with entry/target/stop
  let recs: any[];
  try {
    recs = serializeRecords<any>(
      await db.select().from(recsTable)
        .where(or(eq(recsTable.status, "active"), eq(recsTable.status, "expired")))
    );
  } catch {
    // Table may be empty or query cache stale — treat as no data
    recs = [];
  }

  const results: OutcomeResult[] = [];

  for (const rec of recs) {
    try {
      const legs = rec.legs as any[];
      if (!legs || legs.length < 1) continue;

      const firstLeg = legs[0];
      const isSingleLeg = legs.length === 1;

      // Single-leg: track by absolute price vs stopLoss/takeProfit
      // Multi-leg: track by spread
      if (isSingleLeg) {
        if (!firstLeg.stopLoss && !firstLeg.takeProfit) continue;
        const sym = firstLeg.asset?.replace(/\d+/, "").toUpperCase();
        if (!sym) continue;

        const createdAt = new Date(rec.createdAt);
        const bars = await db.select({ close: marketData.close, timestamp: marketData.timestamp })
          .from(marketData)
          .where(and(eq(marketData.symbol, sym), gte(marketData.timestamp, createdAt)))
          .orderBy(desc(marketData.timestamp)).limit(30);
        if (!bars.length) continue;

        const entryPrice = firstLeg.entryPriceRef ?? firstLeg.entryZone
          ? ((firstLeg.entryZone as [number, number])[0] + (firstLeg.entryZone as [number, number])[1]) / 2
          : bars[bars.length - 1].close;
        const currentPrice = bars[0].close;
        const targetPrice = firstLeg.takeProfit;
        const stopPrice = firstLeg.stopLoss;
        const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const isLong = firstLeg.direction === "long";

        let maxFavorable = 0, maxAdverse = 0;
        for (const bar of bars) {
          const move = isLong ? bar.close - entryPrice : entryPrice - bar.close;
          if (move > maxFavorable) maxFavorable = move;
          if (-move > maxAdverse) maxAdverse = -move;
        }

        let outcome: OutcomeResult["outcome"] = "open";
        if (targetPrice != null && stopPrice != null) {
          if (isLong) {
            if (currentPrice >= targetPrice) outcome = "win";
            else if (currentPrice <= stopPrice) outcome = "loss";
          } else {
            if (currentPrice <= targetPrice) outcome = "win";
            else if (currentPrice >= stopPrice) outcome = "loss";
          }
        }

        const maxDays = rec.maxHoldingDays || 30;
        if (outcome === "open" && daysElapsed >= maxDays) outcome = "expired";

        results.push({
          recommendationId: rec.id,
          assets: [sym],
          daysElapsed,
          spreadAtEntry: entryPrice,
          spreadNow: currentPrice,
          targetSpread: targetPrice ?? 0,
          stopSpread: stopPrice ?? 0,
          maxFavorable,
          maxAdverse,
          outcome,
        });

        if (outcome !== "open") {
          await db.update(recsTable)
            .set({
              status: outcome === "win" ? "completed" : "expired",
              backtestSummary: {
                ...(rec.backtestSummary || {}),
                outcome, daysElapsed,
                priceAtEntry: entryPrice, priceAtClose: currentPrice,
                maxFavorable, maxAdverse,
              },
            } as any)
            .where(eq(recsTable.id, rec.id));
        }
        continue;
      }

      // ── Multi-leg (spread) tracking ──
      if (!firstLeg.entryZone || !firstLeg.stopLoss || !firstLeg.takeProfit) continue;

      const sym1 = legs[0].asset?.replace(/\d+/, "").toUpperCase();
      const sym2 = legs[1]?.asset?.replace(/\d+/, "").toUpperCase();
      if (!sym1 || !sym2) continue;

      // Get entry spread (midpoint of entryZone)
      const entryZone = firstLeg.entryZone as [number, number];
      const spreadAtEntry = (entryZone[0] + entryZone[1]) / 2;
      const targetSpread = firstLeg.takeProfit;
      const stopSpread = firstLeg.stopLoss;

      // Fetch price data since recommendation creation
      const createdAt = new Date(rec.createdAt);
      const bars1 = await db.select({ close: marketData.close, timestamp: marketData.timestamp })
        .from(marketData)
        .where(and(eq(marketData.symbol, sym1), gte(marketData.timestamp, createdAt)))
        .orderBy(desc(marketData.timestamp)).limit(30);
      const bars2 = await db.select({ close: marketData.close, timestamp: marketData.timestamp })
        .from(marketData)
        .where(and(eq(marketData.symbol, sym2), gte(marketData.timestamp, createdAt)))
        .orderBy(desc(marketData.timestamp)).limit(30);

      if (!bars1.length || !bars2.length) continue;

      // Compute current spread
      const currentSpread = bars1[0].close - bars2[0].close;
      const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));

      // Compute MFE/MAE from spread history
      let maxFavorable = 0;
      let maxAdverse = 0;
      const minLen = Math.min(bars1.length, bars2.length);
      for (let i = 0; i < minLen; i++) {
        const spread = bars1[i].close - bars2[i].close;
        const favorable = Math.abs(spread - spreadAtEntry) * (targetSpread > spreadAtEntry ? 1 : -1);
        const adverse = -favorable;
        if (favorable > maxFavorable) maxFavorable = favorable;
        if (adverse > maxAdverse) maxAdverse = adverse;
      }

      // Determine outcome
      let outcome: OutcomeResult["outcome"] = "open";
      const isLongSpread = targetSpread > stopSpread;
      if (isLongSpread) {
        if (currentSpread >= targetSpread) outcome = "win";
        else if (currentSpread <= stopSpread) outcome = "loss";
      } else {
        if (currentSpread <= targetSpread) outcome = "win";
        else if (currentSpread >= stopSpread) outcome = "loss";
      }

      // Expire after max holding days or 30 days default
      const maxDays = rec.maxHoldingDays || 30;
      if (outcome === "open" && daysElapsed >= maxDays) outcome = "expired";

      results.push({
        recommendationId: rec.id,
        assets: [sym1, sym2],
        daysElapsed,
        spreadAtEntry,
        spreadNow: currentSpread,
        targetSpread,
        stopSpread,
        maxFavorable,
        maxAdverse,
        outcome,
      });

      // Update recommendation status if resolved
      if (outcome !== "open") {
        await db.update(recsTable)
          .set({
            status: outcome === "win" ? "completed" : "expired",
            backtestSummary: {
              ...(rec.backtestSummary || {}),
              outcome,
              daysElapsed,
              spreadAtEntry,
              spreadAtClose: currentSpread,
              maxFavorable,
              maxAdverse,
            },
          } as any)
          .where(eq(recsTable.id, rec.id));
      }
    } catch (err) {
      console.error(`[outcome-tracker] Failed for rec ${rec.id}:`, err);
    }
  }

  return results;
}
