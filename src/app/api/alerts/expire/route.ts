import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import { and, lt, eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';

// PATCH /api/alerts/expire - Batch expire alerts
export async function PATCH(request: NextRequest) {
  try {
    const now = new Date();

    // Update all active alerts that have expired
    const updated = await db
      .update(alerts)
      .set({
        status: 'expired',
        updatedAt: now,
      })
      .where(
        and(
          eq(alerts.status, 'active'),
          lt(alerts.expiresAt, now)
        )
      )
      .returning();

    const response: ApiResponse<{ count: number }> = {
      success: true,
      data: { count: updated.length },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/alerts/expire error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to expire alerts',
        },
      },
      { status: 500 }
    );
  }
}
