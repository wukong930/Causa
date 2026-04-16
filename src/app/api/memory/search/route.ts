import { NextRequest, NextResponse } from "next/server";
import { queryRelatedHypotheses } from "@/lib/memory/hypothesis-store";
import { queryPerformanceByRegime } from "@/lib/memory/performance-store";
import { getCurrentRegime, getRegimeHistory } from "@/lib/memory/regime-store";

// POST /api/memory/search — semantic search across memory stores
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, vector, regimeLabel, strategyId, limit = 5 } = body as {
      type: "hypothesis" | "performance" | "regime";
      vector?: number[];
      regimeLabel?: string;
      strategyId?: string;
      limit?: number;
    };

    if (type === "hypothesis" && vector) {
      const results = await queryRelatedHypotheses(vector, limit);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === "performance" && regimeLabel) {
      const results = await queryPerformanceByRegime(regimeLabel, limit);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === "regime") {
      if (regimeLabel === "current") {
        const current = await getCurrentRegime();
        return NextResponse.json({ success: true, data: current });
      }
      const history = await getRegimeHistory(limit);
      return NextResponse.json({ success: true, data: history });
    }

    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid search type or missing parameters" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/memory/search error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Memory search failed" } },
      { status: 500 }
    );
  }
}
