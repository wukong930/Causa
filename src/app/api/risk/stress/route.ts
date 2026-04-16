import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { positions as positionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runStressTest, STRESS_SCENARIOS, type StressScenario } from "@/lib/risk/stress";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup } from "@/types/domain";

async function getOpenPositions(): Promise<PositionGroup[]> {
  const rows = await db.select().from(positionsTable).where(eq(positionsTable.status, "open"));
  return serializeRecords<PositionGroup>(rows);
}

// POST /api/risk/stress — run stress tests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pos = await getOpenPositions();
    const scenarios: StressScenario[] | undefined = body.scenarios ?? undefined;
    const results = runStressTest(pos, scenarios);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("POST /api/risk/stress error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Stress test failed" } },
      { status: 500 }
    );
  }
}

// GET /api/risk/stress — run with default scenarios
export async function GET() {
  try {
    const pos = await getOpenPositions();
    const results = runStressTest(pos, STRESS_SCENARIOS);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET /api/risk/stress error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Stress test failed" } },
      { status: 500 }
    );
  }
}
