import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { CommodityNode } from '@/types/domain';
import { mockNodes } from '@/mocks/graph';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/commodity-graph/nodes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cluster = searchParams.get('cluster');

    let data: CommodityNode[] = [...mockNodes];
    if (cluster) {
      data = data.filter((n) => n.cluster === cluster);
    }

    const response: ApiListResponse<CommodityNode> = {
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/commodity-graph/nodes error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch commodity nodes' } },
      { status: 500 }
    );
  }
}
