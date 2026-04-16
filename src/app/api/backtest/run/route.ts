import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest/client";

// POST /api/backtest/run — proxy to Python backtest service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await runBacktest(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/backtest/run error:", error);
    const message = error instanceof Error ? error.message : "Backtest failed";
    return NextResponse.json(
      { success: false, error: { code: "BACKTEST_ERROR", message } },
      { status: 502 }
    );
  }
}
