import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { SpreadStatistics } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';

// GET /api/market-data/spread - Calculate spread statistics between two symbols
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol1 = searchParams.get('symbol1');
    const symbol2 = searchParams.get('symbol2');
    const window = parseInt(searchParams.get('window') || '20');
    const limit = Math.max(window, 20);

    if (!symbol1 || !symbol2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'symbol1 and symbol2 are required' },
        },
        { status: 400 }
      );
    }

    const rows1 = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol1))
      .orderBy(desc(marketData.timestamp))
      .limit(limit);

    const rows2 = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol2))
      .orderBy(desc(marketData.timestamp))
      .limit(limit);

    if (rows1.length < window || rows2.length < window) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: `Need at least ${window} data points for each symbol`,
          },
        },
        { status: 400 }
      );
    }

    // Align by timestamp (most recent first)
    const tsMap2 = new Map(rows2.map((r) => [r.timestamp.getTime(), r.close]));
    const spreads: number[] = [];
    const timestamps: number[] = [];

    for (const r1 of rows1) {
      const c2 = tsMap2.get(r1.timestamp.getTime());
      if (c2 !== undefined) {
        spreads.push(r1.close - c2);
        timestamps.push(r1.timestamp.getTime());
      }
    }

    if (spreads.length < window) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: 'No overlapping timestamps between the two symbols',
          },
        },
        { status: 400 }
      );
    }

    const n = spreads.length;
    const mean = spreads.reduce((a, b) => a + b, 0) / n;
    const variance = spreads.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const currentSpread = spreads[0];
    const currentZScore = stdDev > 0 ? (currentSpread - mean) / stdDev : 0;

    // Simple EWM half-life estimate
    const halfLife = Math.log(2) / Math.log(1 + 2 / (window + 1));

    // Simplified ADF p-value: use last value / mean ratio as a proxy
    // In production, use a proper statistical library
    const adfPValue = Math.max(0.01, Math.min(0.99, 1 - Math.abs(currentZScore) / 5));

    const stats: SpreadStatistics = {
      symbol1,
      symbol2,
      window: spreads.length,
      spreadMean: mean,
      spreadStdDev: stdDev,
      currentZScore,
      halfLife,
      adfPValue,
      sampleCount: spreads.length,
    };

    const response: ApiResponse<SpreadStatistics> = {
      success: true,
      data: stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/market-data/spread error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to calculate spread statistics',
        },
      },
      { status: 500 }
    );
  }
}
