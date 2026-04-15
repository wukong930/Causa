import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { Suggestion } from '@/types/domain';
import { mockSuggestions } from '@/mocks/suggestions';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/suggestions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let data = [...mockSuggestions];
    if (status) {
      data = data.filter((s) => s.status === status);
    }

    const response: ApiListResponse<Suggestion> = {
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/suggestions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch suggestions' } },
      { status: 500 }
    );
  }
}
