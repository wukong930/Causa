import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/db";
import { alerts, recommendations, signalTrack } from "@/db/schema";
import { and, lt, inArray, sql } from "drizzle-orm";

const RETENTION_DAYS = 90;

// POST /api/cron/cleanup — delete historical data older than 90 days
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
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
        inArray(signalTrack.outcome, ["hit", "miss"]),
        lt(signalTrack.createdAt, cutoff),
      ))
      .returning({ id: signalTrack.id });

    const result = {
      alerts: deletedAlerts.length,
      recommendations: deletedRecs.length,
      signals: deletedSignals.length,
      cutoffDate: cutoff.toISOString(),
    };

    console.log(`[cleanup] Deleted: ${result.alerts} alerts, ${result.recommendations} recs, ${result.signals} signals (before ${cutoff.toISOString().slice(0, 10)})`);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/cron/cleanup error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 }
    );
  }
}
