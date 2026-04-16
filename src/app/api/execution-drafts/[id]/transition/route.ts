import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { executionDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { transition, canTransition, type LegEvent } from "@/lib/execution/state-machine";
import { serializeRecords } from "@/lib/serialize";
import type { ExecutionDraft } from "@/types/domain";

// POST /api/execution-drafts/[id]/transition — transition a leg's status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { legIndex, event } = body as { legIndex: number; event: LegEvent };

    if (legIndex == null || !event) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "legIndex and event required" } },
        { status: 400 }
      );
    }

    const rows = await db.select().from(executionDrafts).where(eq(executionDrafts.id, id));
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Execution draft not found" } },
        { status: 404 }
      );
    }

    const draft = serializeRecords<ExecutionDraft>(rows)[0];
    const leg = draft.legs[legIndex];
    if (!leg) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: `Leg index ${legIndex} not found` } },
        { status: 400 }
      );
    }

    if (!canTransition(leg.legStatus, event)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TRANSITION", message: `Cannot ${event} from ${leg.legStatus}` } },
        { status: 422 }
      );
    }

    const newStatus = transition(leg.legStatus, event);
    const updatedLegs = [...draft.legs];
    updatedLegs[legIndex] = { ...leg, legStatus: newStatus };

    await db.update(executionDrafts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle JSON column typing limitation
      .set({ legs: updatedLegs, updatedAt: new Date() } as any)
      .where(eq(executionDrafts.id, id));

    return NextResponse.json({
      success: true,
      data: { legIndex, previousStatus: leg.legStatus, newStatus, event },
    });
  } catch (error) {
    console.error("POST /api/execution-drafts/[id]/transition error:", error);
    const message = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "Transition failed";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
