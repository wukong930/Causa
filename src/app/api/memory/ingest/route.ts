import { NextRequest, NextResponse } from "next/server";
import { storeHypothesis } from "@/lib/memory/hypothesis-store";
import type { HypothesisMemoryRecord } from "@/lib/memory/hypothesis-store";
import { storePerformance } from "@/lib/memory/performance-store";
import type { PerformanceMemoryRecord } from "@/lib/memory/performance-store";
import { storeRegime } from "@/lib/memory/regime-store";
import type { RegimeContextRecord } from "@/lib/memory/regime-store";
import { ensureMemorySchema } from "@/lib/memory/schema";

// POST /api/memory/ingest — write data to memory stores
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, vector } = body as {
      type: "hypothesis" | "performance" | "regime" | "init";
      data?: HypothesisMemoryRecord | PerformanceMemoryRecord | RegimeContextRecord;
      vector?: number[];
    };

    // Initialize schema
    if (type === "init") {
      await ensureMemorySchema();
      return NextResponse.json({ success: true, data: { message: "Memory schema initialized" } });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "data is required" } },
        { status: 400 }
      );
    }

    let id: string;

    switch (type) {
      case "hypothesis":
        id = await storeHypothesis(data as HypothesisMemoryRecord, vector);
        break;
      case "performance":
        id = await storePerformance(data as PerformanceMemoryRecord);
        break;
      case "regime":
        id = await storeRegime(data as RegimeContextRecord);
        break;
      default:
        return NextResponse.json(
          { success: false, error: { code: "BAD_REQUEST", message: "Invalid type" } },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: { id, type } });
  } catch (error) {
    console.error("POST /api/memory/ingest error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Memory ingest failed" } },
      { status: 500 }
    );
  }
}
