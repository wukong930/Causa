import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { signalTrack, alerts } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";

export async function GET() {
  try {
    // Overall stats (exclude skipped)
    const [overall] = await db.select({
      total: sql<number>`count(*) filter (where ${signalTrack.outcome} != 'skipped')::int`,
      hits: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'hit')::int`,
      misses: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'miss')::int`,
      pending: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'pending')::int`,
    }).from(signalTrack);

    // By category (exclude skipped)
    const byCategory = await db.select({
      category: signalTrack.category,
      total: sql<number>`count(*) filter (where ${signalTrack.outcome} != 'skipped')::int`,
      hits: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'hit')::int`,
      misses: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'miss')::int`,
    }).from(signalTrack).groupBy(signalTrack.category);

    // By signal type (exclude skipped)
    const byType = await db.select({
      signalType: signalTrack.signalType,
      total: sql<number>`count(*) filter (where ${signalTrack.outcome} != 'skipped')::int`,
      hits: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'hit')::int`,
      misses: sql<number>`count(*) filter (where ${signalTrack.outcome} = 'miss')::int`,
    }).from(signalTrack).groupBy(signalTrack.signalType);

    // Recent signals (last 50) with alert title
    const recentRows = await db.select({
      id: signalTrack.id,
      alertId: signalTrack.alertId,
      signalType: signalTrack.signalType,
      category: signalTrack.category,
      confidence: signalTrack.confidence,
      zScore: signalTrack.zScore,
      regime: signalTrack.regime,
      outcome: signalTrack.outcome,
      createdAt: signalTrack.createdAt,
      resolvedAt: signalTrack.resolvedAt,
      alertTitle: alerts.title,
    }).from(signalTrack)
      .leftJoin(alerts, eq(signalTrack.alertId, alerts.id))
      .orderBy(sql`${signalTrack.createdAt} desc`)
      .limit(50);

    const resolved = (overall.hits ?? 0) + (overall.misses ?? 0);
    const hitRate = resolved > 0 ? (overall.hits ?? 0) / resolved : 0;

    return NextResponse.json({
      success: true,
      data: {
        overall: { ...overall, hitRate, resolved },
        byCategory: byCategory.map((c) => {
          const res = (c.hits ?? 0) + (c.misses ?? 0);
          return { ...c, hitRate: res > 0 ? (c.hits ?? 0) / res : 0 };
        }),
        byType: byType.map((t) => {
          const res = (t.hits ?? 0) + (t.misses ?? 0);
          return { ...t, hitRate: res > 0 ? (t.hits ?? 0) / res : 0 };
        }),
        recent: recentRows,
      },
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, outcome } = body;
    if (!id || !["hit", "miss"].includes(outcome)) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "id and outcome (hit/miss) required" } },
        { status: 400 }
      );
    }
    await db.update(signalTrack)
      .set({ outcome, resolvedAt: new Date() })
      .where(eq(signalTrack.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/analytics error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update signal" } },
      { status: 500 }
    );
  }
}
