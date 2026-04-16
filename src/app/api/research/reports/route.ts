import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { researchReports } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { ResearchReport } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockReports } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/reports
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    return NextResponse.json({
      success: true,
      data: mockReports,
      meta: { total: mockReports.length, page: 1, pageSize: mockReports.length },
    } satisfies ApiListResponse<ResearchReport>);
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = db.select().from(researchReports).orderBy(desc(researchReports.publishedAt));
    if (type) {
      query = query.where(eq(researchReports.type, type)) as typeof query;
    }

    const rows = await query;
    const data = serializeRecords<ResearchReport>(rows);

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<ResearchReport>);
  } catch (error) {
    console.error('GET /api/research/reports error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch research reports' } },
      { status: 500 }
    );
  }
}
