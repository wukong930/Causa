import { NextRequest, NextResponse } from "next/server";
import { runScenario, type ScenarioAssumption } from "@/lib/sector/scenario";
import { mockEdges } from "@/mocks/graph";
import { mockSectorAssessments } from "@/mocks/sector-assessments";
import type { SectorAssessment } from "@/types/domain";

/**
 * Mock base prices for scenario simulation.
 * In production these come from market_data table.
 */
const MOCK_BASE_PRICES = new Map<string, number>([
  // Ferrous
  ["RB", 3720], ["HC", 3850], ["SS", 14200], ["I", 880], ["J", 2350], ["JM", 1680], ["SF", 7800], ["SM", 6500],
  // Energy
  ["SC", 560], ["FU", 3200], ["LU", 4100], ["BU", 3600], ["PP", 7500], ["TA", 5650], ["MEG", 4200], ["MA", 2600],
  ["EB", 8200], ["PG", 4500], ["SA", 1800], ["UR", 2100], ["V", 6300], ["L", 7800],
  // Agriculture
  ["P", 7800], ["Y", 8200], ["M", 3400], ["OI", 9500], ["RM", 2800], ["CF", 15200], ["SR", 6800],
  ["AP", 8500], ["C", 2500], ["CS", 3200], ["A", 4800], ["JD", 4200], ["LH", 15500],
]);

/**
 * POST /api/sectors/scenario
 * Body: { assumptions: [{ symbol: "I", priceChangePct: 0.20 }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const assumptions: ScenarioAssumption[] = body.assumptions;

    if (!assumptions || !Array.isArray(assumptions) || assumptions.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "assumptions array is required" } },
        { status: 400 },
      );
    }

    for (const a of assumptions) {
      if (!a.symbol || typeof a.priceChangePct !== "number") {
        return NextResponse.json(
          { success: false, error: { code: "BAD_REQUEST", message: "Each assumption needs symbol and priceChangePct" } },
          { status: 400 },
        );
      }
    }

    // Build base assessments map from mock data
    const baseAssessments = new Map<string, SectorAssessment>();
    for (const a of mockSectorAssessments) {
      baseAssessments.set(a.symbol, a);
    }

    const result = runScenario({
      assumptions,
      basePrices: MOCK_BASE_PRICES,
      edges: mockEdges,
      baseAssessments,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/sectors/scenario error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Scenario simulation failed" } },
      { status: 500 },
    );
  }
}
