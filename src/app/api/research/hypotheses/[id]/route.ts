import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { Hypothesis } from '@/types/domain';
import { mockHypotheses } from '@/mocks/research';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/research/hypotheses/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const hypothesis = mockHypotheses.find((h) => h.id === id);
  if (!hypothesis) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
      { status: 404 }
    );
  }

  const response: ApiResponse<Hypothesis> = { success: true, data: hypothesis };
  return NextResponse.json(response);
}

// PATCH /api/research/hypotheses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const idx = mockHypotheses.findIndex((h) => h.id === id);
  if (idx === -1) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Hypothesis not found' } },
      { status: 404 }
    );
  }

  const updated: Hypothesis = { ...mockHypotheses[idx], ...body };
  mockHypotheses[idx] = updated;

  const response: ApiResponse<Hypothesis> = { success: true, data: updated };
  return NextResponse.json(response);
}
