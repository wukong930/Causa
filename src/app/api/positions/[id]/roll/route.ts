import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { positions, executionDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildRollDrafts } from "@/lib/execution/lifecycle";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup } from "@/types/domain";

// POST /api/positions/[id]/roll — create a roll (close old + open new contract) draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fromContract, toContract, size, reason } = body;

    if (!fromContract || !toContract || size == null) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "fromContract, toContract, and size required" } },
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
    const draft = buildRollDrafts(position, { positionId: id, fromContract, toContract, size, reason });

    const [created] = await db.insert(executionDrafts).values({
      ...draft,
      legs: draft.legs,
    } as any).returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("POST /api/positions/[id]/roll error:", error);
    const message = error instanceof Error ? error.message : "Roll failed";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
