import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { positions, executionDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildPartialCloseDraft } from "@/lib/execution/lifecycle";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup } from "@/types/domain";

// POST /api/positions/[id]/close — create a partial/full close draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { legIndex, closeSize, reason } = body;

    if (legIndex == null || closeSize == null) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "legIndex and closeSize required" } },
        { status: 400 }
      );
    }

    const rows = await db.select().from(positions).where(eq(positions.id, id));
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Position not found" } },
        { status: 404 }
      );
    }

    const position = serializeRecords<PositionGroup>(rows)[0];
    const draft = buildPartialCloseDraft(position, { positionId: id, legIndex, closeSize, reason });

    const [created] = await db.insert(executionDrafts).values({
      ...draft,
      legs: draft.legs,
    } as any).returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("POST /api/positions/[id]/close error:", error);
    const message = error instanceof Error ? error.message : "Close failed";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
