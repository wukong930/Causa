import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/db";
import { alerts, recommendations, signalTrack } from "@/db/schema";
import { and, lt, eq, inArray, sql, isNotNull } from "drizzle-orm";

const RETENTION_DAYS = 90;

// POST /api/cron/cleanup — expire stale records + delete old historical data
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const now = new Date();

    // Step 1: Mark expired alerts (expires_at < now AND still active)
    const expiredAlerts = await db.update(alerts)
      .set({ status: "expired", updatedAt: now })
      .where(and(
        eq(alerts.status, "active"),
        isNotNull(alerts.expiresAt),
        lt(alerts.expiresAt, now),
      ))
      .returning({ id: alerts.id });

    // Step 2: Mark expired recommendations (expires_at < now AND still active)
    const expiredRecs = await db.update(recommendations)
      .set({ status: "expired", updatedAt: now })
      .where(and(
        eq(recommendations.status, "active"),
        lt(recommendations.expiresAt, now),
      ))
      .returning({ id: recommendations.id });

    // Step 3: Delete old historical data (90 days retention)
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const deletedAlerts = await db.delete(alerts)
      .where(and(
        inArray(alerts.status, ["expired", "archived"]),
        lt(alerts.triggeredAt, cutoff),
      ))
      .returning({ id: alerts.id });

    const deletedRecs = await db.delete(recommendations)
      .where(and(
        inArray(recommendations.status, ["expired", "superseded"]),
        lt(recommendations.createdAt, cutoff),
      ))
      .returning({ id: recommendations.id });

    const deletedSignals = await db.delete(signalTrack)
      .where(and(
        inArray(signalTrack.outcome, ["hit", "miss", "skipped"]),
        lt(signalTrack.createdAt, cutoff),
      ))
      .returning({ id: signalTrack.id });

    const result = {
      expiredAlerts: expiredAlerts.length,
      expiredRecs: expiredRecs.length,
      deletedAlerts: deletedAlerts.length,
      deletedRecs: deletedRecs.length,
      deletedSignals: deletedSignals.length,
    };

    console.log(`[cleanup] Expired: ${result.expiredAlerts} alerts, ${result.expiredRecs} recs. Deleted: ${result.deletedAlerts} alerts, ${result.deletedRecs} recs, ${result.deletedSignals} signals`);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/cron/cleanup error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 }
    );
  }
}
