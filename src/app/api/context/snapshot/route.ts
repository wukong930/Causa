import { NextResponse } from "next/server";
import { buildFullContext } from "@/lib/context/builder";

// GET /api/context/snapshot — get current context vector
export async function GET() {
  try {
    const context = await buildFullContext();
    return NextResponse.json({ success: true, data: context });
  } catch (error) {
    console.error("GET /api/context/snapshot error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to build context" } },
      { status: 500 }
    );
  }
}
