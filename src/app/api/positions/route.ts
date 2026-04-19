import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { PositionGroup } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

// GET /api/positions - List all positions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = db.select().from(positions);

    if (status) {
      query = query.where(eq(positions.status, status)) as any;
    }

    const results = await query.orderBy(desc(positions.openedAt));

    const response: ApiListResponse<PositionGroup> = {
      success: true,
      data: serializeRecords<PositionGroup>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/positions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch positions' } },
      { status: 500 }
    );
  }
}

// POST /api/positions - Create a new position
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { legs, entrySpread, spreadUnit, exitCondition, targetZScore, strategyName } = body;

    if (!legs?.length || entrySpread == null || !spreadUnit || !exitCondition) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' } },
        { status: 400 }
      );
    }

    const totalMargin = legs.reduce((s: number, l: any) => s + (l.marginUsed || 0), 0);
    const totalPnl = legs.reduce((s: number, l: any) => s + (l.unrealizedPnl || 0), 0);

    const [created] = await db.insert(positions).values({
      strategyName: strategyName || null,
      legs,
      openedAt: new Date(),
      entrySpread,
      currentSpread: entrySpread,
      spreadUnit,
      unrealizedPnl: totalPnl,
      totalMarginUsed: totalMargin,
      exitCondition,
      targetZScore: targetZScore ?? 0,
      currentZScore: 0,
      halfLifeDays: 0,
      daysHeld: 0,
      status: 'open',
    }).returning();

    return NextResponse.json({ success: true, data: created } as ApiResponse<typeof created>);
  } catch (error) {
    console.error('POST /api/positions error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create position' } },
      { status: 500 }
    );
  }
}
