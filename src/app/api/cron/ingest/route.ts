import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { ingestDailyData } from '@/lib/data-sources/market-ingest';

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const count = await ingestDailyData();
    return NextResponse.json({
      success: true,
      data: { inserted: count, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Ingest cron error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Market data ingestion failed' } },
      { status: 500 }
    );
  }
}
