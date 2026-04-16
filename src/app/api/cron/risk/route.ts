import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { db } from "@/db";
import { positions as positionsTable, marketData as marketDataTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { calculateVaR } from "@/lib/risk/var";
import { runStressTest } from "@/lib/risk/stress";
import { buildCorrelationMatrix } from "@/lib/risk/correlation";
import { serializeRecords } from "@/lib/serialize";
import type { PositionGroup, MarketDataPoint } from "@/types/domain";

// POST /api/cron/risk — recalculate VaR, stress tests, correlation
export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const posRows = await db.select().from(positionsTable).where(eq(positionsTable.status, "open"));
    const pos = serializeRecords<PositionGroup>(posRows);

    const symbols = [...new Set(pos.flatMap((p) => p.legs.map((l) => l.asset)))];
    const marketDataBySymbol: Record<string, MarketDataPoint[]> = {};

    // Parallelize market data queries (batch of 10 to avoid pool exhaustion)
    const BATCH_SIZE = 10;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (sym) => {
          const rows = await db.select().from(marketDataTable)
            .where(eq(marketDataTable.symbol, sym))
            .orderBy(desc(marketDataTable.timestamp))
            .limit(252);
          return { sym, data: serializeRecords<MarketDataPoint>(rows) };
        })
      );
      for (const { sym, data } of results) {
        marketDataBySymbol[sym] = data;
      }
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
