import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { RelationshipEdge } from '@/types/domain';
import { mockEdges } from '@/mocks/graph';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/commodity-graph/edges
export async function GET() {
  try {
    const response: ApiListResponse<RelationshipEdge> = {
      success: true,
      data: mockEdges,
      meta: { total: mockEdges.length, page: 1, pageSize: mockEdges.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/commodity-graph/edges error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch relationship edges' } },
      { status: 500 }
    );
  }
}
