import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hypotheses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { ResearchHypothesis } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockResearchHypotheses } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/hypotheses
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    return NextResponse.json({
      success: true,
      data: mockResearchHypotheses,
      meta: { total: mockResearchHypotheses.length, page: 1, pageSize: mockResearchHypotheses.length },
    } satisfies ApiListResponse<ResearchHypothesis>);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db.select().from(hypotheses).orderBy(desc(hypotheses.createdAt));
    if (status) {
      query = query.where(eq(hypotheses.status, status)) as typeof query;
    }

    const rows = await query;
    const data = serializeRecords<ResearchHypothesis>(rows);

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<ResearchHypothesis>);
  } catch (error) {
    console.error('GET /api/research/hypotheses error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch hypotheses' } },
      { status: 500 }
    );
  }
}
