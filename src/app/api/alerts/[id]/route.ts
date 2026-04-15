import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { Alert } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/alerts/[id] - Get single alert
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<Alert> = {
      success: true,
      data: serializeRecord<Alert>(result[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/alerts/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch alert',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/alerts/[id] - Update alert status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await db
      .update(alerts)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<Alert> = {
      success: true,
      data: serializeRecord<Alert>(updated[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/alerts/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update alert',
        },
      },
      { status: 500 }
    );
  }
}
