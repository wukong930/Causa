import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { PositionGroup } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

// GET /api/positions - List all positions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = db.select().from(positions);

    if (status) {
      query = query.where(eq(positions.status, status)) as any;
    }

    const results = await query.orderBy(desc(positions.openedAt));

    const response: ApiListResponse<PositionGroup> = {
      success: true,
      data: serializeRecords<PositionGroup>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/positions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch positions',
        },
      },
      { status: 500 }
    );
  }
}
