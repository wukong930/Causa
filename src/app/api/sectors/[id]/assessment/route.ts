import { NextRequest, NextResponse } from "next/server";
import type { AlertCategory } from "@/types/domain";
import { generateSectorDetail } from "@/lib/sector/hierarchy";
import { mockSectorAssessments } from "@/mocks/sector-assessments";

/**
 * GET /api/sectors/[id]/assessment
 * L1 sector detail — per-symbol breakdown with key factors.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sectorId = id as AlertCategory;

  try {
    // TODO: when DB is live, query sector_assessments WHERE sector = sectorId
    const detail = generateSectorDetail(sectorId, mockSectorAssessments);

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error(`GET /api/sectors/${id}/assessment error:`, error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate sector assessment" } },
      { status: 500 },
    );
  }
}
