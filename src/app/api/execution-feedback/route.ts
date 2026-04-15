import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { executionFeedback } from '@/db/schema';
import { desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { ExecutionFeedback } from '@/types/domain';
import { serializeRecords, serializeRecord } from '@/lib/serialize';

// GET /api/execution-feedback - List execution feedback
export async function GET(request: NextRequest) {
  try {
    const results = await db
      .select()
      .from(executionFeedback)
      .orderBy(desc(executionFeedback.createdAt));

    const response: ApiListResponse<ExecutionFeedback> = {
      success: true,
      data: serializeRecords<ExecutionFeedback>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/execution-feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch execution feedback',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/execution-feedback - Create execution feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newFeedback = await db
      .insert(executionFeedback)
      .values({
        recommendationId: body.recommendationId,
        strategyId: body.strategyId,
        legs: body.legs,
        totalMarginUsed: body.totalMarginUsed,
        totalCommission: body.totalCommission,
        slippageNote: body.slippageNote,
        liquidityNote: body.liquidityNote,
        notes: body.notes,
      })
      .returning();

    const response: ApiResponse<ExecutionFeedback> = {
      success: true,
      data: serializeRecord<ExecutionFeedback>(newFeedback[0]),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/execution-feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create execution feedback',
        },
      },
      { status: 500 }
    );
  }
}
