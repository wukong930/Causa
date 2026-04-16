import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { runOrchestration } from "@/lib/pipeline/orchestrator";

// POST /api/cron/evolution — trigger evolution cycle
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const result = await runOrchestration();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/cron/evolution error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Evolution cron failed" } },
      { status: 500 }
    );
  }
}
