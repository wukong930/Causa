import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { Suggestion } from '@/types/domain';
import { mockSuggestions } from '@/mocks/suggestions';

// GET /api/suggestions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const suggestion = mockSuggestions.find((s) => s.id === id);
  if (!suggestion) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
      { status: 404 }
    );
  }

  const response: ApiResponse<Suggestion> = { success: true, data: suggestion };
  return NextResponse.json(response);
}

// PATCH /api/suggestions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const idx = mockSuggestions.findIndex((s) => s.id === id);
  if (idx === -1) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
      { status: 404 }
    );
  }

  const updated: Suggestion = {
    ...mockSuggestions[idx],
    ...body,
    updatedAt: new Date().toISOString(),
  };
  mockSuggestions[idx] = updated;

  const response: ApiResponse<Suggestion> = { success: true, data: updated };
  return NextResponse.json(response);
}
