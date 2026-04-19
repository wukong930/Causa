import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { commodityNodes, marketData } from '@/db/schema';
import { alerts as alertsTable } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { CommodityNode } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockNodes } from '@/mocks/graph';
import { COMMODITY_NAME_MAP } from '@/lib/constants';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// Symbol → cluster mapping
const SYMBOL_CLUSTER: Record<string, string> = {
  RB: "ferrous", HC: "ferrous", SS: "ferrous", I: "ferrous", J: "ferrous", JM: "ferrous", SF: "ferrous", SM: "ferrous",
  CU: "nonferrous", AL: "nonferrous", ZN: "nonferrous", NI: "nonferrous", SN: "nonferrous", PB: "nonferrous", AU: "nonferrous", AG: "nonferrous", BC: "nonferrous",
  SC: "energy", FU: "energy", LU: "energy", BU: "energy", PP: "energy", TA: "energy", MEG: "energy", MA: "energy", EB: "energy", PG: "energy", SA: "energy", UR: "energy", V: "energy", L: "energy",
  P: "agriculture", Y: "agriculture", M: "agriculture", OI: "agriculture", RM: "agriculture", CF: "agriculture", SR: "agriculture", AP: "agriculture", C: "agriculture", CS: "agriculture", A: "agriculture", JD: "agriculture", LH: "agriculture", SP: "agriculture", PK: "agriculture",
};

// GET /api/commodity-graph/nodes
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    const { searchParams } = new URL(request.url);
    const cluster = searchParams.get('cluster');
    let data = [...mockNodes];
    if (cluster) data = data.filter((n) => n.cluster === cluster);
    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<CommodityNode>);
  }

  try {
    const { searchParams } = new URL(request.url);
    const cluster = searchParams.get('cluster');

    let query = db.select().from(commodityNodes);
    if (cluster) {
      query = query.where(eq(commodityNodes.cluster, cluster)) as typeof query;
    }

    const rows = await query;
    let data = serializeRecords<CommodityNode>(rows);

    // If table is empty, generate nodes dynamically from COMMODITY_NAME_MAP
    if (data.length === 0) {
      // Count active alerts per symbol
      const alertRows = await db.select({ relatedAssets: alertsTable.relatedAssets })
        .from(alertsTable).where(eq(alertsTable.status, 'active'));
      const alertCount: Record<string, number> = {};
      for (const row of alertRows) {
        for (const sym of (row.relatedAssets as string[])) {
          const base = sym.replace(/\d+/, '').toUpperCase();
          alertCount[base] = (alertCount[base] ?? 0) + 1;
        }
      }

      // Compute 24h price change from marketData (latest 2 bars per symbol)
      const priceChanges: Record<string, number> = {};
      const symbols = Object.keys(COMMODITY_NAME_MAP);
      for (const sym of symbols) {
        try {
          const bars = await db.select({ close: marketData.close })
            .from(marketData)
            .where(eq(marketData.symbol, sym))
            .orderBy(desc(marketData.timestamp))
            .limit(2);
          if (bars.length === 2 && bars[1].close > 0) {
            priceChanges[sym] = ((bars[0].close - bars[1].close) / bars[1].close) * 100;
          }
        } catch { /* skip */ }
      }

      data = Object.entries(COMMODITY_NAME_MAP).map(([sym, name]) => ({
        id: sym.toLowerCase(),
        name,
        symbol: sym,
        cluster: (SYMBOL_CLUSTER[sym] ?? "overseas") as CommodityNode["cluster"],
        exchange: "SHFE",
        status: alertCount[sym] ? "alert" as const : "normal" as const,
        activeAlertCount: alertCount[sym] ?? 0,
        regime: "unknown" as const,
        priceChange24h: priceChanges[sym] ?? 0,
      }));

      if (cluster) data = data.filter((n) => n.cluster === cluster);
    }

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<CommodityNode>);
  } catch (error) {
    console.error('GET /api/commodity-graph/nodes error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch commodity nodes' } },
      { status: 500 }
    );
  }
}
