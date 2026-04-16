import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { ResearchHypothesis } from '@/types/domain';
import { mockResearchHypotheses } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/hypotheses
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    const response: ApiListResponse<ResearchHypothesis> = {
      success: true,
      data: mockResearchHypotheses,
      meta: { total: mockResearchHypotheses.length, page: 1, pageSize: mockResearchHypotheses.length },
    };
    return NextResponse.json(response);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let data = [...mockResearchHypotheses];
    if (status) {
      data = data.filter((h) => h.status === status);
    }

    const response: ApiListResponse<ResearchHypothesis> = {
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/research/hypotheses error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch hypotheses' } },
      { status: 500 }
    );
  }
}
