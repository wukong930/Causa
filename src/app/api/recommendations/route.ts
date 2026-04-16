import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { recommendations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { Recommendation } from '@/types/domain';
import { serializeRecord, serializeRecords } from '@/lib/serialize';

// GET /api/recommendations - List recommendations with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const action = searchParams.get('action');

    let query = db.select().from(recommendations);

    const conditions = [];
    if (status) {
      conditions.push(eq(recommendations.status, status));
    }
    if (action) {
      conditions.push(eq(recommendations.recommendedAction, action));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(recommendations.createdAt));

    const response: ApiListResponse<Recommendation> = {
      success: true,
      data: serializeRecords<Recommendation>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/recommendations error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch recommendations',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/recommendations - Create a new recommendation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { recommendedAction, legs, priorityScore, reasoning, strategyId, alertId } = body;
    if (!recommendedAction || !legs || !Array.isArray(legs)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'recommendedAction and legs[] are required' } },
        { status: 400 }
      );
    }

    const now = new Date();
    const [created] = await db.insert(recommendations).values({
      status: body.status ?? 'pending',
      recommendedAction,
      legs,
      priorityScore: priorityScore ?? 50,
      portfolioFitScore: body.portfolioFitScore ?? 50,
      marginEfficiencyScore: body.marginEfficiencyScore ?? 50,
      marginRequired: body.marginRequired ?? 0,
      reasoning: reasoning ?? '',
      riskItems: body.riskItems ?? [],
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 7 * 86400000),
      createdAt: now,
      updatedAt: now,
      strategyId: strategyId ?? null,
      alertId: alertId ?? null,
    }).returning();

    const response: ApiResponse<Recommendation> = {
      success: true,
      data: serializeRecord<Recommendation>(created),
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/recommendations error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create recommendation' } },
      { status: 500 }
    );
  }
}
