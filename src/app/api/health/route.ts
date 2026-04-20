import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketData } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { scheduler } from "@/lib/scheduler/manager";

export async function GET(request: NextRequest) {
  const detail = request.nextUrl.searchParams.get("detail") === "true";

  const basic = {
    status: "ok" as "ok" | "degraded" | "down",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
  };

  if (!detail) {
    return NextResponse.json(basic);
  }

  // Detailed health check
  const checks: Record<string, { status: string; detail?: any }> = {};

  // 1. Database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok" };
  } catch (e: any) {
    checks.database = { status: "down", detail: e.message };
    basic.status = "down";
  }

  // 2. Data freshness
  try {
    const [latest] = await db
      .select({ ts: marketData.timestamp })
      .from(marketData)
      .orderBy(desc(marketData.timestamp))
      .limit(1);
    const latestTs = latest?.ts?.getTime() ?? 0;
    const ageHours = (Date.now() - latestTs) / (1000 * 60 * 60);
    checks.marketData = {
      status: ageHours > 48 ? "stale" : ageHours > 24 ? "warning" : "ok",
      detail: {
        latestTimestamp: latest?.ts?.toISOString() ?? null,
        ageHours: Math.round(ageHours * 10) / 10,
      },
    };
    if (ageHours > 48 && basic.status === "ok") basic.status = "degraded";
  } catch (e: any) {
    checks.marketData = { status: "error", detail: e.message };
  }

  // 3. Scheduler health
  const schedulerHealth = scheduler.getHealthSummary();
  checks.scheduler = {
    status: schedulerHealth.degradedJobs.length > 0 ? "degraded" : "ok",
    detail: schedulerHealth,
  };
  if (schedulerHealth.degradedJobs.length > 0 && basic.status === "ok") {
    basic.status = "degraded";
  }

  // 4. Weaviate connectivity
  try {
    const { getWeaviateClient } = await import("@/lib/memory/client");
    const client = await getWeaviateClient();
    const ready = await client.isReady();
    checks.weaviate = { status: ready ? "ok" : "down" };
    if (!ready && basic.status === "ok") basic.status = "degraded";
  } catch (e: any) {
    checks.weaviate = { status: "down", detail: e.message };
    if (basic.status === "ok") basic.status = "degraded";
  }

  return NextResponse.json({ ...basic, checks });
}
