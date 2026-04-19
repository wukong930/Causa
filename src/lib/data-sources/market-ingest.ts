import { db } from '@/db';
import { marketData } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';

const SYMBOLS = [
  // 黑色
  { symbol: 'RB2506', commodity: '螺纹钢', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'HC2506', commodity: '热卷', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'I2506', commodity: '铁矿石', exchange: 'DCE', market: 'DCE' },
  { symbol: 'J2506', commodity: '焦炭', exchange: 'DCE', market: 'DCE' },
  { symbol: 'JM2506', commodity: '焦煤', exchange: 'DCE', market: 'DCE' },
  // 有色
  { symbol: 'CU2506', commodity: '铜', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AL2506', commodity: '铝', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'ZN2506', commodity: '锌', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'NI2506', commodity: '镍', exchange: 'SHFE', market: 'SHFE' },
  // 能化
  { symbol: 'SC2506', commodity: '原油', exchange: 'INE', market: 'INE' },
  { symbol: 'PP2506', commodity: '聚丙烯', exchange: 'DCE', market: 'DCE' },
  { symbol: 'TA2506', commodity: 'PTA', exchange: 'ZCE', market: 'ZCE' },
  { symbol: 'MEG2506', commodity: '乙二醇', exchange: 'DCE', market: 'DCE' },
  { symbol: 'MA2506', commodity: '甲醇', exchange: 'ZCE', market: 'ZCE' },
  // 农产品
  { symbol: 'P2506', commodity: '棕榈油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'Y2506', commodity: '豆油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'M2506', commodity: '豆粕', exchange: 'DCE', market: 'DCE' },
  { symbol: 'CF2506', commodity: '棉花', exchange: 'ZCE', market: 'ZCE' },
  // 贵金属
  { symbol: 'AU2506', commodity: '黄金', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AG2506', commodity: '白银', exchange: 'SHFE', market: 'SHFE' },
];

// Base prices per symbol (realistic CNY levels)
const BASE_PRICES: Record<string, number> = {
  RB2506: 3650, HC2506: 3850, I2506: 880, J2506: 2150, JM2506: 1580,
  CU2506: 72000, AL2506: 20500, ZN2506: 22800, NI2506: 128000,
  SC2506: 560, PP2506: 7800, TA2506: 5900, MEG2506: 4600, MA2506: 2650,
  P2506: 8200, Y2506: 7900, M2506: 3200, CF2506: 14500,
  AU2506: 580, AG2506: 7200,
};

function generateOHLCV(basePrice: number) {
  const change = (Math.random() - 0.48) * basePrice * 0.02; // slight upward bias, ±1%
  const open = basePrice;
  const close = basePrice + change;
  const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
  const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
  const settle = close + (Math.random() - 0.5) * basePrice * 0.002;
  const volume = Math.floor(50000 + Math.random() * 100000);
  const openInterest = Math.floor(200000 + Math.random() * 300000);
  return { open: Math.round(open), high: Math.round(high), low: Math.round(low), close: Math.round(close), settle: Math.round(settle), volume, openInterest };
}

/**
 * Seed 60 days of historical data for all watched symbols.
 * Called once on startup if market_data is empty.
 */
export async function seedHistoricalData(): Promise<number> {
  const rows: any[] = [];
  const now = new Date();
  const DAYS = 90; // ~63 trading days after removing weekends, need ≥60

  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    let price = BASE_PRICES[symbol] || 3500;

    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      date.setHours(15, 0, 0, 0);

      const bar = generateOHLCV(price);
      rows.push({
        id: `${symbol}_${date.toISOString()}`,
        market, exchange, commodity, symbol,
        contractMonth: '2506',
        timestamp: date,
        ...bar,
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
      });
      price = bar.close; // next day starts from previous close
    }
  }

  // Batch insert
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(marketData).values(rows.slice(i, i + batchSize)).onConflictDoNothing();
  }
  console.log(`[market-ingest] Seeded ${rows.length} historical records for ${SYMBOLS.length} symbols`);
  return rows.length;
}

/**
 * Append today's OHLCV for all watched symbols.
 * Called daily by the ingest cron job.
 */
export async function ingestDailyData(): Promise<number> {
  const now = new Date();
  // Skip weekends
  if (now.getDay() === 0 || now.getDay() === 6) return 0;

  let inserted = 0;
  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    const ts = new Date(now);
    ts.setHours(15, 0, 0, 0);
    const id = `${symbol}_${ts.toISOString()}`;

    // Get last close price as base
    const last = await db.select({ close: marketData.close })
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(1);

    const basePrice = last[0]?.close ?? (BASE_PRICES[symbol] || 3500);
    const bar = generateOHLCV(basePrice);

    await db.insert(marketData).values({
      id, market, exchange, commodity, symbol,
      contractMonth: '2506',
      timestamp: ts,
      ...bar,
      currency: 'CNY',
      timezone: 'Asia/Shanghai',
    }).onConflictDoNothing();
    inserted++;
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
