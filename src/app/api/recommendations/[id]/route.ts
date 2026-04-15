import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { recommendations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { Recommendation } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/recommendations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Recommendation not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<Recommendation> = {
      success: true,
      data: serializeRecord<Recommendation>(result[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/recommendations/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch recommendation',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/recommendations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await db
      .update(recommendations)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(recommendations.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Recommendation not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<Recommendation> = {
      success: true,
      data: serializeRecord<Recommendation>(updated[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/recommendations/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update recommendation',
        },
      },
      { status: 500 }
    );
  }
}
