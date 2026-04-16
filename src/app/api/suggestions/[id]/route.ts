import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suggestions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { Suggestion } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';
import { mockSuggestions } from '@/mocks/suggestions';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/suggestions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (USE_MOCK) {
    const suggestion = mockSuggestions.find((s) => s.id === id);
    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: suggestion } satisfies ApiResponse<Suggestion>);
  }

  try {
    const rows = await db.select().from(suggestions).where(eq(suggestions.id, id));
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeRecord<Suggestion>(rows[0]) });
  } catch (error) {
    console.error('GET /api/suggestions/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch suggestion' } },
      { status: 500 }
    );
  }
}

// PATCH /api/suggestions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (USE_MOCK) {
    const idx = mockSuggestions.findIndex((s) => s.id === id);
    if (idx === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }
    const updated: Suggestion = { ...mockSuggestions[idx], ...body, updatedAt: new Date().toISOString() };
    mockSuggestions[idx] = updated;
    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse<Suggestion>);
  }

  try {
    const rows = await db.update(suggestions)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(suggestions.id, id))
      .returning();
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Suggestion not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: serializeRecord<Suggestion>(rows[0]) });
  } catch (error) {
    console.error('PATCH /api/suggestions/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update suggestion' } },
      { status: 500 }
    );
  }
}
