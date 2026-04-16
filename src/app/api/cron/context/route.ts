import { NextResponse } from "next/server";
import { buildFullContext } from "@/lib/context/builder";

// POST /api/cron/context — refresh GDELT + macro context
export async function POST() {
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
