import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { autoEvaluateSignals } from "@/lib/analytics/auto-evaluate";

// POST /api/cron/auto-eval — auto-evaluate pending signals
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await autoEvaluateSignals();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/cron/auto-eval error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Auto-eval failed" } },
      { status: 500 }
    );
  }
}
