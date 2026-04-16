import { NextResponse } from "next/server";
import { fetchMacroIndicators } from "@/lib/context/macro";

// GET /api/context/macro — get current macro indicators
export async function GET() {
  try {
    const macro = await fetchMacroIndicators();
    return NextResponse.json({ success: true, data: macro });
  } catch (error) {
    console.error("GET /api/context/macro error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Macro fetch failed" } },
      { status: 500 }
    );
  }
}
