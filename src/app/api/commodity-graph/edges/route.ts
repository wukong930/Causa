import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { relationshipEdges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { RelationshipEdge } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockEdges } from '@/mocks/graph';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// GET /api/commodity-graph/edges
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    let data = [...mockEdges];
    if (type) data = data.filter((e) => e.type === type);
    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<RelationshipEdge>);
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = db.select().from(relationshipEdges);
    if (type) {
      query = query.where(eq(relationshipEdges.type, type)) as typeof query;
    }

    const rows = await query;
    const data = serializeRecords<RelationshipEdge>(rows);

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<RelationshipEdge>);
  } catch (error) {
    console.error('GET /api/commodity-graph/edges error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch relationship edges' } },
      { status: 500 }
    );
  }
}
