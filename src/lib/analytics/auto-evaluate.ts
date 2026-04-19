/**
 * Auto-evaluate pending signals by checking if the spread moved
 * toward the predicted direction (mean reversion).
 */
import { db } from "@/db";
import { signalTrack, alerts, marketData } from "@/db/schema";
import { eq, and, lt, desc, sql } from "drizzle-orm";

const MIN_CONFIDENCE = 0.7;
const MIN_AGE_HOURS = 24;

export async function autoEvaluateSignals(): Promise<{
  evaluated: number;
  skipped: number;
  hits: number;
  misses: number;
}> {
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);

  // Get pending signals older than 24h
  const pending = await db
    .select()
    .from(signalTrack)
    .where(and(
      eq(signalTrack.outcome, "pending"),
      lt(signalTrack.createdAt, cutoff),
    ))
    .limit(100);

  let evaluated = 0;
  let skipped = 0;
  let hits = 0;
  let misses = 0;

  for (const signal of pending) {
    // Skip low-confidence signals
    if (signal.confidence < MIN_CONFIDENCE) {
      await db.update(signalTrack)
        .set({ outcome: "skipped", resolvedAt: new Date() })
        .where(eq(signalTrack.id, signal.id));
      skipped++;
      continue;
    }

    // Get the associated alert for spread info
    if (!signal.alertId) {
      await db.update(signalTrack)
        .set({ outcome: "skipped", resolvedAt: new Date() })
        .where(eq(signalTrack.id, signal.id));
      skipped++;
      continue;
    }

    const [alert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, signal.alertId))
      .limit(1);

    if (!alert) {
      skipped++;
      continue;
    }

    const spreadInfo = alert.spreadInfo as any;
    if (!spreadInfo?.leg1) {
      // Single-asset signal — evaluate by price direction
      const relatedAssets = alert.relatedAssets as string[];
      if (!relatedAssets?.length) { skipped++; continue; }

      const symbol = relatedAssets[0];
      const recentData = await db.select()
        .from(marketData)
        .where(eq(marketData.symbol, symbol))
        .orderBy(desc(marketData.timestamp))
        .limit(2);

      if (recentData.length < 2) { skipped++; continue; }

      // For single-asset momentum signals, check if price moved in predicted direction
      const priceChange = recentData[0].close - recentData[1].close;
      const originalZ = signal.zScore ?? 0;
      // If z > 0 predicted down (mean revert), if z < 0 predicted up
      const predictedDown = originalZ > 0;
      const isHit = predictedDown ? priceChange < 0 : priceChange > 0;

      await db.update(signalTrack)
        .set({ outcome: isHit ? "hit" : "miss", resolvedAt: new Date() })
        .where(eq(signalTrack.id, signal.id));

      if (isHit) hits++; else misses++;
      evaluated++;
      continue;
    }

    // Spread signal — check if z-score moved toward zero
    const originalZ = signal.zScore ?? spreadInfo.zScore ?? 0;
    if (Math.abs(originalZ) < 0.1) { skipped++; continue; }

    // Get latest market data for both legs
    const [data1] = await db.select()
      .from(marketData)
      .where(eq(marketData.symbol, spreadInfo.leg1))
      .orderBy(desc(marketData.timestamp))
      .limit(1);

    const [data2] = await db.select()
      .from(marketData)
      .where(eq(marketData.symbol, spreadInfo.leg2))
      .orderBy(desc(marketData.timestamp))
      .limit(1);

    if (!data1 || !data2) { skipped++; continue; }

    const currentSpread = data1.close - data2.close;
    const mean = spreadInfo.historicalMean ?? 0;
    const stdDev = (spreadInfo.sigma1Upper - mean) || 1;
    const currentZ = stdDev > 0 ? (currentSpread - mean) / stdDev : 0;

    // Hit if z-score moved toward zero (mean reversion occurred)
    const isHit = Math.abs(currentZ) < Math.abs(originalZ);

    await db.update(signalTrack)
      .set({ outcome: isHit ? "hit" : "miss", resolvedAt: new Date() })
      .where(eq(signalTrack.id, signal.id));

    if (isHit) hits++; else misses++;
    evaluated++;
  }

  console.log(`[auto-eval] Evaluated: ${evaluated}, Skipped: ${skipped}, Hits: ${hits}, Misses: ${misses}`);
  return { evaluated, skipped, hits, misses };
}
