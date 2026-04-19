import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { commodityNodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { CommodityNode } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockNodes } from '@/mocks/graph';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

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
    const data = serializeRecords<CommodityNode>(rows);

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
