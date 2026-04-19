import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { researchReports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { ResearchReport } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';
import { mockReports } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// GET /api/research/reports/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (USE_MOCK) {
    const report = mockReports.find((r) => r.id === id);
    if (!report) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Research report not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: report } satisfies ApiResponse<ResearchReport>);
  }

  try {
    const rows = await db.select().from(researchReports).where(eq(researchReports.id, id));
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Research report not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeRecord<ResearchReport>(rows[0]) });
  } catch (error) {
    console.error('GET /api/research/reports/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch research report' } },
      { status: 500 }
    );
  }
}
