import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { buildFullContext } from "@/lib/context/builder";

// POST /api/cron/context — refresh GDELT + macro context
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const context = await buildFullContext();
    return NextResponse.json({ success: true, data: context });
  } catch (error) {
    console.error("POST /api/cron/context error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Context refresh failed" } },
      { status: 500 }
    );
  }
}
