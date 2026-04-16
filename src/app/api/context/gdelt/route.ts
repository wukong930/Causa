import { NextRequest, NextResponse } from "next/server";
import { fetchGDELTEvents } from "@/lib/context/gdelt";

// GET /api/context/gdelt — fetch recent GDELT events
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query") ?? undefined;
    const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");

    const events = await fetchGDELTEvents(query, limit);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error("GET /api/context/gdelt error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "GDELT fetch failed" } },
      { status: 500 }
    );
  }
}
