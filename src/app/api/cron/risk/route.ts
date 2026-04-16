import { NextResponse } from "next/server";
import { db } from "@/db";
import { positions as positionsTable, marketData as marketDataTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { calculateVaR } from "@/lib/risk/var";
import { runStressTest } from "@/lib/risk/stress";
import { buildCorrelationMatrix } from "@/lib/risk/correlation";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup, MarketDataPoint } from "@/types/domain";

// POST /api/cron/risk — recalculate VaR, stress tests, correlation
export async function POST() {
  try {
    const posRows = await db.select().from(positionsTable).where(eq(positionsTable.status, "open"));
    const pos = serializeRecords<PositionGroup>(posRows);

    const symbols = [...new Set(pos.flatMap((p) => p.legs.map((l) => l.asset)))];
    const marketDataBySymbol: Record<string, MarketDataPoint[]> = {};
    for (const sym of symbols) {
      const rows = await db.select().from(marketDataTable)
        .where(eq(marketDataTable.symbol, sym))
        .orderBy(desc(marketDataTable.timestamp))
        .limit(252);
      marketDataBySymbol[sym] = serializeRecords<MarketDataPoint>(rows);
    }

    const varResult = calculateVaR(pos, marketDataBySymbol);
    const stressResults = runStressTest(pos);
    const correlation = buildCorrelationMatrix(marketDataBySymbol, symbols);

    return NextResponse.json({
      success: true,
      data: { var: varResult, stress: stressResults, correlation },
    });
  } catch (error) {
    console.error("POST /api/cron/risk error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Risk cron failed" } },
      { status: 500 }
    );
  }
}
