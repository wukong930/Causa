import { NextRequest, NextResponse } from "next/server";
import { getHypothesisHistory } from "@/lib/memory/hypothesis-store";

// GET /api/reasoning/hypotheses — list generated hypotheses from memory
export async function GET(request: NextRequest) {
  try {
    const strategyId = request.nextUrl.searchParams.get("strategyId");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");

    if (!strategyId) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "strategyId is required" } },
        { status: 400 }
      );
    }

    const hypotheses = await getHypothesisHistory(strategyId, limit);

    return NextResponse.json({
      success: true,
      data: hypotheses,
    });
  } catch (error) {
    console.error("GET /api/reasoning/hypotheses error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch hypotheses" } },
      { status: 500 }
    );
  }
}
