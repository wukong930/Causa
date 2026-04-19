import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { Alert } from '@/types/domain';
import { serializeRecords, serializeRecord } from '@/lib/serialize';

// POST /api/alerts - Create new alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date();

    const [alert] = await db
      .insert(alerts)
      .values({
        ...body,
        triggeredAt: body.triggeredAt ? new Date(body.triggeredAt) : now,
        updatedAt: now,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      .returning();

    const response: ApiResponse<Alert> = {
      success: true,
      data: serializeRecord<Alert>(alert),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/alerts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create alert',
        },
      },
      { status: 500 }
    );
  }
}

// GET /api/alerts - List alerts with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');

    let query = db.select().from(alerts);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(alerts.status, status));
    }
    if (severity) {
      conditions.push(eq(alerts.severity, severity));
    }
    if (category) {
      conditions.push(eq(alerts.category, category));
    }

    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Get total count
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` }).from(alerts).where(conditions.length > 0 ? and(...conditions) : undefined);

    const results = await query
      .orderBy(desc(alerts.triggeredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const response: ApiListResponse<Alert> = {
      success: true,
      data: serializeRecords<Alert>(results),
      meta: {
        total,
        page,
        pageSize,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch alerts',
        },
      },
      { status: 500 }
    );
  }
}
