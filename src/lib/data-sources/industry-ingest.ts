import { db } from '@/db';
import { industryData } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL || 'http://localhost:8100';

const INDUSTRY_SYMBOLS = [
  // Ferrous
  'RB', 'HC', 'SS', 'I', 'J', 'JM', 'SF', 'SM',
  // Nonferrous
  'CU', 'AL', 'ZN', 'NI', 'SN', 'PB', 'AG', 'AU', 'BC',
  // Energy
  'SC', 'FU', 'LU', 'BU',
  // Chemical
  'PP', 'TA', 'MEG', 'MA', 'EB', 'PG', 'SA', 'UR', 'V', 'L',
  // Agriculture
  'P', 'Y', 'M', 'OI', 'RM', 'CF', 'SR', 'AP', 'C', 'CS',
  'A', 'JD', 'LH', 'SP', 'PK',
  // GFEX
  'SI', 'LC',
];

interface IndustryPoint {
  symbol: string;
  data_type: string;
  value: number;
  unit: string;
  date: string;
  source: string;
}

/**
 * Ingest industry data (inventory, spot prices, basis) for all watched symbols.
 */
export async function ingestIndustryData(): Promise<number> {
  let inserted = 0;

  for (const symbol of INDUSTRY_SYMBOLS) {
    // Determine limit: 60 for first-time symbols, 5 for incremental
    let inventoryLimit = 5;
    try {
      const existing = await db.select({ value: count() }).from(industryData)
        .where(and(eq(industryData.symbol, symbol), eq(industryData.dataType, 'inventory')));
      if ((existing[0]?.value ?? 0) === 0) inventoryLimit = 60;
    } catch { /* default to 5 */ }

    // Inventory
    try {
      const res = await fetch(`${BACKTEST_URL}/industry/inventory/${symbol}?limit=${inventoryLimit}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const points: IndustryPoint[] = await res.json();
        for (const p of points) {
          try {
            await db.insert(industryData).values({
              symbol: p.symbol, dataType: p.data_type,
              value: p.value, unit: p.unit, source: p.source,
              timestamp: new Date(p.date),
            } as any);
            inserted++;
          } catch { /* duplicate or other error, skip */ }
        }
      }
    } catch { /* graceful degradation */ }

    // Basis
    try {
      const res = await fetch(`${BACKTEST_URL}/industry/basis/${symbol}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const p: IndustryPoint = await res.json();
        try {
          await db.insert(industryData).values({
            symbol: p.symbol, dataType: p.data_type,
            value: p.value, unit: p.unit, source: p.source,
            timestamp: new Date(p.date),
          } as any);
          inserted++;
        } catch { /* duplicate or other error, skip */ }
      }
    } catch { /* graceful degradation */ }

    // Position rank (龙虎榜)
    try {
      const res = await fetch(`${BACKTEST_URL}/industry/position-rank/${symbol}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const points: IndustryPoint[] = await res.json();
        for (const p of points) {
          try {
            await db.insert(industryData).values({
              symbol: p.symbol, dataType: p.data_type,
              value: p.value, unit: p.unit, source: p.source,
              timestamp: new Date(p.date),
            } as any);
            inserted++;
          } catch { /* duplicate */ }
        }
      }
    } catch { /* graceful degradation */ }
  }

  // ── Global data sources (not per-symbol) ──

  // Volatility index (50ETF iVX)
  try {
    const res = await fetch(`${BACKTEST_URL}/industry/volatility`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const points: IndustryPoint[] = await res.json();
      for (const p of points) {
        try {
          await db.insert(industryData).values({
            symbol: p.symbol, dataType: p.data_type,
            value: p.value, unit: p.unit, source: p.source,
            timestamp: new Date(p.date),
          } as any);
          inserted++;
        } catch { /* duplicate */ }
      }
    }
  } catch { /* graceful degradation */ }

  // Fund flow (沪深港通)
  try {
    const res = await fetch(`${BACKTEST_URL}/industry/fund-flow`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const points: IndustryPoint[] = await res.json();
      for (const p of points) {
        try {
          await db.insert(industryData).values({
            symbol: p.symbol, dataType: p.data_type,
            value: p.value, unit: p.unit, source: p.source,
            timestamp: new Date(p.date),
          } as any);
          inserted++;
        } catch { /* duplicate */ }
      }
    }
  } catch { /* graceful degradation */ }

  // Weather for agricultural symbols
  const WEATHER_SYMBOLS = ['M', 'C', 'CF', 'SR', 'AP'];
  for (const symbol of WEATHER_SYMBOLS) {
    try {
      const res = await fetch(`${BACKTEST_URL}/industry/weather/${symbol}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const points: IndustryPoint[] = await res.json();
        for (const p of points) {
          try {
            await db.insert(industryData).values({
              symbol: p.symbol, dataType: p.data_type,
              value: p.value, unit: p.unit, source: p.source,
              timestamp: new Date(p.date),
            } as any);
            inserted++;
          } catch { /* duplicate */ }
        }
      }
    } catch { /* graceful degradation */ }
  }

  console.log(`[industry-ingest] Ingested ${inserted} industry data points`);
  return inserted;
}
