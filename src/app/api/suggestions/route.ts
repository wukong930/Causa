import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suggestions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiListResponse } from '@/types/api';
import type { Suggestion } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { mockSuggestions } from '@/mocks/suggestions';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.DATABASE_URL;

// GET /api/suggestions
export async function GET(request: NextRequest) {
  if (USE_MOCK) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    let data = [...mockSuggestions];
    if (status) data = data.filter((s) => s.status === status);
    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<Suggestion>);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db.select().from(suggestions).orderBy(desc(suggestions.createdAt));
    if (status) {
      query = query.where(eq(suggestions.status, status)) as typeof query;
    }

    const rows = await query;
    const data = serializeRecords<Suggestion>(rows);

    return NextResponse.json({
      success: true,
      data,
      meta: { total: data.length, page: 1, pageSize: data.length },
    } satisfies ApiListResponse<Suggestion>);
  } catch (error) {
    console.error('GET /api/suggestions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch suggestions' } },
      { status: 500 }
    );
  }
}
