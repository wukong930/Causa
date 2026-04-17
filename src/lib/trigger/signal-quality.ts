/**
 * Signal quality tracking — records signal emissions and computes
 * historical hit rates per signal type for ensemble weighting.
 */
import { db } from "@/db";
import { signalTrack } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { AlertType, AlertCategory } from "@/types/domain";

/**
 * Record a signal emission when an alert is created.
 */
export async function recordSignal(params: {
  alertId: string;
  signalType: AlertType;
  category: AlertCategory;
  confidence: number;
  zScore?: number;
  regime?: string;
}): Promise<void> {
  await db.insert(signalTrack).values({
    alertId: params.alertId,
    signalType: params.signalType,
    category: params.category,
    confidence: params.confidence,
    zScore: params.zScore ?? null,
    regime: params.regime ?? null,
    outcome: "pending",
  });
}

/**
 * Resolve signal outcomes when a position is closed.
 * Links alerts → positions and marks signals as hit/miss.
 */
export async function resolveSignals(
  alertId: string,
  positionId: string,
  outcome: "hit" | "miss"
): Promise<void> {
  await db
    .update(signalTrack)
    .set({
      outcome,
      positionId,
      resolvedAt: new Date(),
    })
    .where(eq(signalTrack.alertId, alertId));
}

export interface SignalHitRate {
  signalType: string;
  totalCount: number;
  hitCount: number;
  hitRate: number;
}

/**
 * Get historical hit rates per signal type.
 * Used by ensemble to weight confidence by track record.
 */
export async function getSignalHitRates(
  category?: AlertCategory
): Promise<SignalHitRate[]> {
  const conditions = [
    sql`${signalTrack.outcome} IN ('hit', 'miss')`,
  ];
  if (category) {
    conditions.push(eq(signalTrack.category, category));
  }

  const rows = await db
    .select({
      signalType: signalTrack.signalType,
      totalCount: sql<number>`count(*)::int`,
      hitCount: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'hit')::int`,
    })
    .from(signalTrack)
    .where(and(...conditions))
    .groupBy(signalTrack.signalType);

  return rows.map((r) => ({
    signalType: r.signalType,
    totalCount: r.totalCount,
    hitCount: r.hitCount,
    hitRate: r.totalCount > 0 ? r.hitCount / r.totalCount : 0.5,
  }));
}
