import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { runEvolutionCycle } from "@/lib/reasoning/pipeline";
import { serializeRecord } from "@/lib/serialize";
import type { Alert } from "@/types/domain";

// POST /api/reasoning/evolve — trigger one evolution cycle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertIds, contextVector, relatedMemory, existingPositions, topN } = body as {
      alertIds?: string[];
      contextVector?: string;
      relatedMemory?: string;
      existingPositions?: string;
      topN?: number;
    };

    // Fetch alerts
    let alertRecords;
    if (alertIds && alertIds.length > 0) {
      alertRecords = await db
        .select()
        .from(alerts)
        .where(inArray(alerts.id, alertIds));
    } else {
      // Default: use recent active alerts
      alertRecords = await db
        .select()
        .from(alerts)
        .where(eq(alerts.status, "active"))
        .limit(10);
    }

    if (alertRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: "NO_ALERTS", message: "No active alerts to process" },
      }, { status: 400 });
    }

    const serializedAlerts = alertRecords.map((a) => serializeRecord<Alert>(a));

    const result = await runEvolutionCycle(
      serializedAlerts,
      { contextVector, relatedMemory, existingPositions },
      { topN }
    );

    return NextResponse.json({
      success: true,
      data: {
        selected: result.selected.map((s) => ({
          hypothesis: s.hypothesis,
          validation: s.validation,
        })),
        summary: result.summary,
        stats: result.stats,
      },
    });
  } catch (error) {
    console.error("POST /api/reasoning/evolve error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Evolution cycle failed" } },
      { status: 500 }
    );
  }
}
