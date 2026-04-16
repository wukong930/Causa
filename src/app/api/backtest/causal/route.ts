import { NextRequest, NextResponse } from "next/server";
import { runCausalValidation } from "@/lib/backtest/client";

// POST /api/backtest/causal — proxy to Python causal validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await runCausalValidation(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/backtest/causal error:", error);
    const message = error instanceof Error ? error.message : "Causal validation failed";
    return NextResponse.json(
      { success: false, error: { code: "CAUSAL_ERROR", message } },
      { status: 502 }
    );
  }
}
