import { NextResponse } from "next/server";
import { generateMarketOverview } from "@/lib/sector/hierarchy";
import { mockSectorAssessments } from "@/mocks/sector-assessments";

/**
 * GET /api/sectors/overview
 * L0 market overview — aggregated sector signals.
 */
export async function GET() {
  try {
    // TODO: when DB is live, query sector_assessments table
    const overview = generateMarketOverview(mockSectorAssessments);

    return NextResponse.json({ success: true, data: overview });
  } catch (error) {
    console.error("GET /api/sectors/overview error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate market overview" } },
      { status: 500 },
    );
  }
}
