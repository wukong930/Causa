import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { ApiResponse, ApiListResponse } from '@/types/api';
import type { MarketDataPoint } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

// GET /api/market-data - Query market data time series
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 10000);

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'symbol is required' },
        },
        { status: 400 }
      );
    }

    const conditions = [eq(marketData.symbol, symbol)];
    if (startDate) {
      conditions.push(gte(marketData.timestamp, new Date(startDate)) as any);
    }
    if (endDate) {
      conditions.push(lte(marketData.timestamp, new Date(endDate)) as any);
    }

    const results = await db
      .select()
      .from(marketData)
      .where(and(...conditions))
      .orderBy(desc(marketData.timestamp))
      .limit(limit);

    const response: ApiListResponse<MarketDataPoint> = {
      success: true,
      data: serializeRecords<MarketDataPoint>(results),
      meta: {
        total: results.length,
        page: 1,
        pageSize: results.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/market-data error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch market data',
        },
      },
      { status: 500 }
    );
  }
}
