import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hypotheses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { ResearchHypothesis } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';
import { mockResearchHypotheses } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// GET /api/research/hypotheses/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (USE_MOCK) {
    const hypothesis = mockResearchHypotheses.find((h) => h.id === id);
    if (!hypothesis) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: hypothesis } satisfies ApiResponse<ResearchHypothesis>);
  }

  try {
    const rows = await db.select().from(hypotheses).where(eq(hypotheses.id, id));
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeRecord<ResearchHypothesis>(rows[0]) });
  } catch (error) {
    console.error('GET /api/research/hypotheses/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch hypothesis' } },
      { status: 500 }
    );
  }
}

// PATCH /api/research/hypotheses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (USE_MOCK) {
    const idx = mockResearchHypotheses.findIndex((h) => h.id === id);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
        { status: 404 }
      );
    }
    const updated: ResearchHypothesis = { ...mockResearchHypotheses[idx], ...body };
    mockResearchHypotheses[idx] = updated;
    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse<ResearchHypothesis>);
  }

  try {
    const rows = await db.update(hypotheses).set(body).where(eq(hypotheses.id, id)).returning();
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeRecord<ResearchHypothesis>(rows[0]) });
  } catch (error) {
    console.error('PATCH /api/research/hypotheses/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update hypothesis' } },
      { status: 500 }
    );
  }
}
