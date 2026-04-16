import { NextResponse } from "next/server";
import { db } from "@/db";
import { positions as positionsTable, marketData as marketDataTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { calculateVaR } from "@/lib/risk/var";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup, MarketDataPoint } from "@/types/domain";

// GET /api/risk/var — portfolio VaR/CVaR
export async function GET() {
  try {
    const posRows = await db.select().from(positionsTable).where(eq(positionsTable.status, "open"));
    const pos = serializeRecords<PositionGroup>(posRows);

    // Collect unique symbols from open positions
    const symbols = [...new Set(pos.flatMap((p) => p.legs.map((l) => l.asset)))];
    const marketDataBySymbol: Record<string, MarketDataPoint[]> = {};
    for (const sym of symbols) {
      const rows = await db.select().from(marketDataTable)
        .where(eq(marketDataTable.symbol, sym))
        .orderBy(desc(marketDataTable.timestamp))
        .limit(252);
      marketDataBySymbol[sym] = serializeRecords<MarketDataPoint>(rows);
    }

    const result = calculateVaR(pos, marketDataBySymbol);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/risk/var error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "VaR calculation failed" } },
      { status: 500 }
    );
  }
}
