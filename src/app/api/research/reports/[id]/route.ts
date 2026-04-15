import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { ResearchReport } from '@/types/domain';
import { mockReports } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/reports/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const report = mockReports.find((r) => r.id === id);
  if (!report) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Research report not found' } },
      { status: 404 }
    );
  }

  const response: ApiResponse<ResearchReport> = { success: true, data: report };
  return NextResponse.json(response);
}
