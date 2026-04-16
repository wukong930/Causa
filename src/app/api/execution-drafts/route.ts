import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { executionDrafts } from '@/db/schema';
import { recommendations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { ExecutionDraft, ExecutionDraftLeg, Direction } from '@/types/domain';
import { serializeRecord, serializeRecords } from '@/lib/serialize';

// GET /api/execution-drafts - List all execution drafts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = db.select().from(executionDrafts);
    if (status) {
      query = query.where(eq(executionDrafts.status, status)) as any;
    }

    const results = await query.orderBy(desc(executionDrafts.createdAt));

    const response: ApiListResponse<ExecutionDraft> = {
      success: true,
      data: serializeRecords<ExecutionDraft>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/execution-drafts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch execution drafts',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/execution-drafts - Create execution draft from recommendation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recommendationId } = body as { recommendationId: string };

    if (!recommendationId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'recommendationId is required',
          },
        },
        { status: 400 }
      );
    }

    // Fetch recommendation
    const [rec] = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, recommendationId))
      .limit(1);

    if (!rec) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recommendation not found' },
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const legs: ExecutionDraftLeg[] = (rec.legs as Array<{ asset: string; direction: Direction; suggestedSize: number; entryPriceRef?: number; unit?: string }>).map((leg) => ({
      asset: leg.asset,
      direction: leg.direction,
      type: 'open' as const,
      requestedSize: leg.suggestedSize,
      requestedPrice: leg.entryPriceRef,
      unit: leg.unit || '手',
      legStatus: 'pending' as const,
    }));

    const [draft] = await db
      .insert(executionDrafts)
      .values({
        recommendationId,
        status: 'draft',
        legs,
        totalMarginUsed: rec.marginRequired,
        totalCommission: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const response: ApiResponse<ExecutionDraft> = {
      success: true,
      data: serializeRecord<ExecutionDraft>(draft),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/execution-drafts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create execution draft',
        },
      },
      { status: 500 }
    );
  }
}
