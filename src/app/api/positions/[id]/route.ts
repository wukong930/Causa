import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { PositionGroup } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/positions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Position not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<PositionGroup> = {
      success: true,
      data: serializeRecord<PositionGroup>(result[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/positions/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch position',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/positions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await db
      .update(positions)
      .set(body)
      .where(eq(positions.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Position not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<PositionGroup> = {
      success: true,
      data: serializeRecord<PositionGroup>(updated[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/positions/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update position',
        },
      },
      { status: 500 }
    );
  }
}
