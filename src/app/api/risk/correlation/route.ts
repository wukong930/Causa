import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketData as marketDataTable, positions as positionsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildCorrelationMatrix } from "@/lib/risk/correlation";
import { serializeRecords } from "@/lib/serialize";
import type { MarketDataPoint, PositionGroup } from "@/types/domain";

// GET /api/risk/correlation — correlation matrix
export async function GET(request: NextRequest) {
  try {
    const symbolsParam = request.nextUrl.searchParams.get("symbols");
    const window = parseInt(request.nextUrl.searchParams.get("window") ?? "60");

    let symbols: string[];
    if (symbolsParam) {
      symbols = symbolsParam.split(",").map((s) => s.trim());
    } else {
      // Default: symbols from open positions
      const posRows = await db.select().from(positionsTable).where(eq(positionsTable.status, "open"));
      const pos = serializeRecords<PositionGroup>(posRows);
      symbols = [...new Set(pos.flatMap((p) => p.legs.map((l) => l.asset)))];
    }

    const marketDataBySymbol: Record<string, MarketDataPoint[]> = {};
    for (const sym of symbols) {
      const rows = await db.select().from(marketDataTable)
        .where(eq(marketDataTable.symbol, sym))
        .orderBy(desc(marketDataTable.timestamp))
        .limit(window + 10);
      marketDataBySymbol[sym] = serializeRecords<MarketDataPoint>(rows);
    }

    const result = buildCorrelationMatrix(marketDataBySymbol, symbols, window);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/risk/correlation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Correlation calculation failed" } },
      { status: 500 }
    );
  }
}
