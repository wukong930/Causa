import { db } from '@/db';
import { marketData } from '@/db/schema';
import { count } from 'drizzle-orm';

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL || 'http://localhost:8100';

const SYMBOLS = [
  // 黑色
  { symbol: 'RB', commodity: '螺纹钢', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'HC', commodity: '热卷', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'I', commodity: '铁矿石', exchange: 'DCE', market: 'DCE' },
  { symbol: 'J', commodity: '焦炭', exchange: 'DCE', market: 'DCE' },
  { symbol: 'JM', commodity: '焦煤', exchange: 'DCE', market: 'DCE' },
  // 有色
  { symbol: 'CU', commodity: '铜', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AL', commodity: '铝', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'ZN', commodity: '锌', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'NI', commodity: '镍', exchange: 'SHFE', market: 'SHFE' },
  // 能化
  { symbol: 'SC', commodity: '原油', exchange: 'INE', market: 'INE' },
  { symbol: 'PP', commodity: '聚丙烯', exchange: 'DCE', market: 'DCE' },
  { symbol: 'TA', commodity: 'PTA', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'MEG', commodity: '乙二醇', exchange: 'DCE', market: 'DCE' },
  { symbol: 'MA', commodity: '甲醇', exchange: 'CZCE', market: 'CZCE' },
  // 农产品
  { symbol: 'P', commodity: '棕榈油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'Y', commodity: '豆油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'M', commodity: '豆粕', exchange: 'DCE', market: 'DCE' },
  { symbol: 'CF', commodity: '棉花', exchange: 'CZCE', market: 'CZCE' },
  // 贵金属
  { symbol: 'AU', commodity: '黄金', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AG', commodity: '白银', exchange: 'SHFE', market: 'SHFE' },
];

// Fallback base prices when AkShare is unavailable
const BASE_PRICES: Record<string, number> = {
  RB: 3650, HC: 3850, I: 880, J: 2150, JM: 1580,
  CU: 72000, AL: 20500, ZN: 22800, NI: 128000,
  SC: 560, PP: 7800, TA: 5900, MEG: 4600, MA: 2650,
  P: 8200, Y: 7900, M: 3200, CF: 14500, AU: 580, AG: 7200,
};

async function seedSymbolFallback(symbol: string, commodity: string, exchange: string, market: string): Promise<number> {
  const rows: any[] = [];
  const now = new Date();
  let price = BASE_PRICES[symbol] || 3500;
  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    date.setHours(15, 0, 0, 0);
    const change = (Math.random() - 0.48) * price * 0.02;
    const close = price + change;
    const high = Math.max(price, close) + Math.random() * price * 0.005;
    const low = Math.min(price, close) - Math.random() * price * 0.005;
    rows.push({
      id: `${symbol}_${date.toISOString()}`, market, exchange, commodity, symbol,
      contractMonth: 'main', timestamp: date,
      open: Math.round(price), high: Math.round(high), low: Math.round(low),
      close: Math.round(close), settle: Math.round(close),
      volume: Math.floor(50000 + Math.random() * 100000),
      openInterest: Math.floor(200000 + Math.random() * 300000),
      currency: 'CNY', timezone: 'Asia/Shanghai',
    });
    price = close;
  }
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(marketData).values(rows.slice(i, i + batchSize)).onConflictDoNothing();
  }
  return rows.length;
}

/**
 * Seed historical data from AkShare for all watched symbols.
 * Falls back to simulated data if backtest service is unavailable.
 */
export async function seedHistoricalData(): Promise<number> {
  let totalInserted = 0;

  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    try {
      const res = await fetch(`${BACKTEST_URL}/market-data/${symbol}?days=90`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        console.warn(`[market-ingest] AkShare unavailable for ${symbol}, using fallback`);
        totalInserted += await seedSymbolFallback(symbol, commodity, exchange, market);
        continue;
      }
      const bars: AkShareBar[] = await res.json();
      const rows = bars.map((bar) => ({
        id: `${symbol}_${bar.date}`,
        market, exchange, commodity, symbol,
        contractMonth: 'main',
        timestamp: new Date(bar.date),
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        settle: bar.close,
        volume: bar.volume, openInterest: bar.open_interest,
        currency: 'CNY', timezone: 'Asia/Shanghai',
      }));

      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        await db.insert(marketData).values(rows.slice(i, i + batchSize) as any).onConflictDoNothing();
      }
      totalInserted += rows.length;
    } catch (err) {
      console.warn(`[market-ingest] Failed to fetch ${symbol} from AkShare:`, err);
      totalInserted += await seedSymbolFallback(symbol, commodity, exchange, market);
    }
  }

  console.log(`[market-ingest] Seeded ${totalInserted} records for ${SYMBOLS.length} symbols`);
  return totalInserted;
}

interface AkShareBar {
  date: string; open: number; high: number; low: number;
  close: number; volume: number; open_interest: number; symbol: string;
}

/**
 * Append today's data from AkShare for all watched symbols.
 */
export async function ingestDailyData(): Promise<number> {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return 0;

  let inserted = 0;
  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    try {
      const res = await fetch(`${BACKTEST_URL}/market-data/${symbol}?days=5`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const bars: AkShareBar[] = await res.json();
      if (!bars.length) continue;

      const latest = bars[bars.length - 1];
      const ts = new Date(latest.date);
      ts.setHours(15, 0, 0, 0);
      const id = `${symbol}_${ts.toISOString()}`;

      await db.insert(marketData).values({
        id, market, exchange, commodity, symbol,
        contractMonth: 'main',
        timestamp: ts,
        open: latest.open, high: latest.high, low: latest.low,
        close: latest.close, settle: latest.close,
        volume: latest.volume, openInterest: latest.open_interest,
        currency: 'CNY', timezone: 'Asia/Shanghai',
      } as any).onConflictDoNothing();
      inserted++;
    } catch (err) {
      console.warn(`[market-ingest] Daily ingest failed for ${symbol}:`, err);
    }
  }
  console.log(`[market-ingest] Ingested ${inserted} daily records`);
  return inserted;
}

/**
 * Check if market_data table has enough data.
 */
export async function hasEnoughData(): Promise<boolean> {
  const result = await db.select({ value: count() }).from(marketData);
  return (result[0]?.value ?? 0) >= 60;
}
