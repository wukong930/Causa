import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData } from '@/db/schema';
import type { ApiResponse } from '@/types/api';
import type { MarketDataPoint } from '@/types/domain';

const BATCH_SIZE = 1000;

// POST /api/market-data/import - Import market data from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No file provided' },
        },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'CSV must have header + data rows' },
        },
        { status: 400 }
      );
    }

    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const errors: string[] = [];
    let imported = 0;

    // Expected header: market,exchange,commodity,symbol,contract_month,timestamp,open,high,low,close,settle,volume,open_interest,currency,timezone
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== header.length) {
        errors.push(`Line ${i + 1}: column count mismatch (expected ${header.length}, got ${values.length})`);
        continue;
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < header.length; j++) {
        row[header[j]] = values[j].trim().replace(/^"|"$/g, '');
      }

      try {
        const symbol = row['symbol'];
        const timestamp = row['timestamp'];
        const id = `${symbol}_${timestamp}`;
        const num = (key: string) => {
          const v = parseFloat(row[key]);
          if (isNaN(v)) throw new Error(`Invalid number for ${key}`);
          return v;
        };

        await db.insert(marketData).values({
          id,
          market: row['market'] || row['market'] || 'UNKNOWN',
          exchange: row['exchange'] || 'UNKNOWN',
          commodity: row['commodity'] || '',
          symbol,
          contractMonth: row['contract_month'] || '',
          timestamp: new Date(timestamp),
          open: num('open'),
          high: num('high'),
          low: num('low'),
          close: num('close'),
          settle: num('settle'),
          volume: num('volume'),
          openInterest: num('open_interest'),
          currency: row['currency'] || 'CNY',
          timezone: row['timezone'] || 'Asia/Shanghai',
        });
        imported++;
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const response: ApiResponse<{ imported: number; errors: string[] }> = {
      success: true,
      data: { imported, errors: errors.slice(0, 100) },
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/market-data/import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to import market data',
        },
      },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
