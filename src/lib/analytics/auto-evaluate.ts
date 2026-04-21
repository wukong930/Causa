/**
 * Auto-evaluate pending signals by checking if the spread moved
 * toward the predicted direction (mean reversion).
 */
import { db } from "@/db";
import { signalTrack, alerts, marketData } from "@/db/schema";
import { eq, and, lt, desc, sql } from "drizzle-orm";

const MIN_CONFIDENCE = 0.7;
const MIN_AGE_HOURS = 72;
const MAX_AGE_HOURS = 720; // 30 days — signals older than this are auto-miss

export async function autoEvaluateSignals(): Promise<{
  evaluated: number;
  skipped: number;
  hits: number;
  misses: number;
}> {
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);
  const expiryCutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

  // Get pending signals older than MIN_AGE_HOURS
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
    // Auto-miss signals older than MAX_AGE_HOURS (never reverted)
    if (signal.createdAt < expiryCutoff) {
      await db.update(signalTrack)
        .set({ outcome: "miss", resolvedAt: new Date() })
        .where(eq(signalTrack.id, signal.id));
      misses++;
      evaluated++;
      continue;
    }
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
    // sigma1Upper = mean + 1σ, so real stdDev = sigma1Upper - mean
    // But we must guard against zero/negative values
    const rawStdDev = spreadInfo.sigma1Upper != null && spreadInfo.historicalMean != null
      ? Math.abs(spreadInfo.sigma1Upper - spreadInfo.historicalMean)
      : 0;
    const stdDev = rawStdDev > 0 ? rawStdDev : 1;
    const currentZ = (currentSpread - mean) / stdDev;

    // Hit if z-score reverted ≥20% toward zero; miss if <20%
    const revertRatio = 1 - Math.abs(currentZ) / Math.abs(originalZ);
    const outcome = revertRatio >= 0.2 ? "hit" : "miss";

    await db.update(signalTrack)
      .set({ outcome, resolvedAt: new Date() })
      .where(eq(signalTrack.id, signal.id));

    if (outcome === "hit") hits++; else misses++;
    evaluated++;
  }

  console.log(`[auto-eval] Evaluated: ${evaluated}, Skipped: ${skipped}, Hits: ${hits}, Misses: ${misses}`);
  return { evaluated, skipped, hits, misses };
}
