import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { strategies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { StrategyPoolItem } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/strategies/[id] - Get single strategy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Strategy not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<StrategyPoolItem> = {
      success: true,
      data: serializeRecord<StrategyPoolItem>(result[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/strategies/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch strategy',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/strategies/[id] - Update strategy
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await db
      .update(strategies)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(strategies.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Strategy not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<StrategyPoolItem> = {
      success: true,
      data: serializeRecord<StrategyPoolItem>(updated[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/strategies/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update strategy',
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/strategies/[id] - Delete strategy (soft delete by setting status to 'retired')
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db
      .update(strategies)
      .set({
        status: 'retired',
        updatedAt: new Date(),
      })
      .where(eq(strategies.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Strategy not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/strategies/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete strategy',
        },
      },
      { status: 500 }
    );
  }
}
