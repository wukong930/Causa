import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { ingestDailyData } from '@/lib/data-sources/market-ingest';
import { ingestIndustryData } from '@/lib/data-sources/industry-ingest';

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const [marketCount, industryCount] = await Promise.all([
      ingestDailyData(),
      ingestIndustryData(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        marketInserted: marketCount,
        industryInserted: industryCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Ingest cron error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Data ingestion failed' } },
      { status: 500 }
    );
  }
}
