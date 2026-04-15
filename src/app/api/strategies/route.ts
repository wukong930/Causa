import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { strategies } from '@/db/schema';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { StrategyPoolItem } from '@/types/domain';
import { serializeRecords, serializeRecord } from '@/lib/serialize';

// GET /api/strategies - List strategies with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = db.select().from(strategies);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(strategies.status, status));
    }
    if (search) {
      conditions.push(
        or(
          ilike(strategies.name, `%${search}%`),
          ilike(strategies.description, `%${search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(strategies.createdAt));

    const response: ApiListResponse<StrategyPoolItem> = {
      success: true,
      data: serializeRecords<StrategyPoolItem>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/strategies error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch strategies',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/strategies - Create new strategy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newStrategy = await db
      .insert(strategies)
      .values({
        name: body.name,
        description: body.description,
        status: body.status || 'draft',
        hypothesis: body.hypothesis,
        validation: body.validation,
        relatedAlertIds: body.relatedAlertIds || [],
        recommendationHistory: body.recommendationHistory || [],
        executionFeedbackIds: body.executionFeedbackIds || [],
        notes: body.notes,
      })
      .returning();

    const response: ApiResponse<StrategyPoolItem> = {
      success: true,
      data: serializeRecord<StrategyPoolItem>(newStrategy[0]),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/strategies error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create strategy',
        },
      },
      { status: 500 }
    );
  }
}
