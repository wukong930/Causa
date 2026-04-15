import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { ResearchReport } from '@/types/domain';
import { mockReports } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/reports
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    const response: ApiListResponse<ResearchReport> = {
      success: true,
      data: mockReports,
      meta: { total: mockReports.length, page: 1, pageSize: mockReports.length },
    };
    return NextResponse.json(response);
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let data = [...mockReports];
    if (type) {
      data = data.filter((r) => r.type === type);
    }

    const response: ApiListResponse<ResearchReport> = {
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/research/reports error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch research reports' } },
      { status: 500 }
    );
  }
}
