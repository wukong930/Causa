import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { Alert } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

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

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(alerts.triggeredAt));

    const response: ApiListResponse<Alert> = {
      success: true,
      data: serializeRecords<Alert>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
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
