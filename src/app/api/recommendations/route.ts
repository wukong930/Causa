import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { recommendations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { Recommendation } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

// GET /api/recommendations - List recommendations with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const action = searchParams.get('action');

    let query = db.select().from(recommendations);

    const conditions = [];
    if (status) {
      conditions.push(eq(recommendations.status, status));
    }
    if (action) {
      conditions.push(eq(recommendations.recommendedAction, action));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(recommendations.createdAt));

    const response: ApiListResponse<Recommendation> = {
      success: true,
      data: serializeRecords<Recommendation>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/recommendations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch recommendations',
        },
      },
      { status: 500 }
    );
  }
}
