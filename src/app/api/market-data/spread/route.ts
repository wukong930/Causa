import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { SpreadStatistics } from '@/types/domain';
import { serializeRecords } from '@/lib/serialize';
import { engleGranger, ouHalfLife, hurstExponent as calcHurst } from '@/lib/stats/cointegration';

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

    // Align by timestamp and collect close prices
    const tsMap2 = new Map(rows2.map((r) => [r.timestamp.getTime(), r.close]));
    const closes1: number[] = [];
    const closes2: number[] = [];
    const timestamps: number[] = [];

    for (const r1 of rows1) {
      const c2 = tsMap2.get(r1.timestamp.getTime());
      if (c2 !== undefined) {
        closes1.push(r1.close);
        closes2.push(c2);
        timestamps.push(r1.timestamp.getTime());
      }
    }

    // Reverse to time-ascending order for regression
    closes1.reverse();
    closes2.reverse();

    if (closes1.length < window) {
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

    // Raw spread statistics (for display)
    const rawSpreads = closes1.map((c, i) => c - closes2[i]);
    const rawMean = rawSpreads.reduce((a, b) => a + b, 0) / rawSpreads.length;
    const rawStdDev = Math.sqrt(rawSpreads.reduce((a, b) => a + (b - rawMean) ** 2, 0) / rawSpreads.length);

    // Engle-Granger cointegration test
    const eg = engleGranger(closes1, closes2);
    const spreads = eg.residuals.length > 0
      ? eg.residuals
      : rawSpreads;

    const n = spreads.length;
    const mean = spreads.reduce((a, b) => a + b, 0) / n;
    const variance = spreads.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const currentSpread = spreads[spreads.length - 1];
    const currentZScore = stdDev > 0 ? (currentSpread - mean) / stdDev : 0;

    // Real OU half-life
    const ou = ouHalfLife(spreads);

    // Real Hurst exponent
    const hurst = calcHurst(spreads);

    const stats: SpreadStatistics = {
      symbol1,
      symbol2,
      window: n,
      spreadMean: mean,
      spreadStdDev: stdDev,
      currentZScore,
      halfLife: ou.halfLife,
      adfPValue: eg.adf.pValue,
      sampleCount: n,
      hurstExponent: hurst,
      hedgeRatio: eg.hedgeRatio,
      cointPValue: eg.cointPValue,
      rawSpreadMean: rawMean,
      rawSpreadStdDev: rawStdDev,
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
