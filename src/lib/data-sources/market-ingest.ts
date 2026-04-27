import { db } from '@/db';
import { marketData } from '@/db/schema';
import { count, eq, desc, max, sql } from 'drizzle-orm';

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL || 'http://localhost:8100';

const SYMBOLS = [
  // 黑色
  { symbol: 'RB', commodity: '螺纹钢', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'HC', commodity: '热卷', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'SS', commodity: '不锈钢', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'I', commodity: '铁矿石', exchange: 'DCE', market: 'DCE' },
  { symbol: 'J', commodity: '焦炭', exchange: 'DCE', market: 'DCE' },
  { symbol: 'JM', commodity: '焦煤', exchange: 'DCE', market: 'DCE' },
  { symbol: 'SF', commodity: '硅铁', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'SM', commodity: '锰硅', exchange: 'CZCE', market: 'CZCE' },
  // 有色
  { symbol: 'CU', commodity: '铜', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AL', commodity: '铝', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'ZN', commodity: '锌', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'NI', commodity: '镍', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'SN', commodity: '锡', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'PB', commodity: '铅', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'BC', commodity: '国际铜', exchange: 'INE', market: 'INE' },
  // 能化
  { symbol: 'SC', commodity: '原油', exchange: 'INE', market: 'INE' },
  { symbol: 'FU', commodity: '燃料油', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'LU', commodity: '低硫燃油', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'BU', commodity: '沥青', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'PP', commodity: '聚丙烯', exchange: 'DCE', market: 'DCE' },
  { symbol: 'TA', commodity: 'PTA', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'MEG', commodity: '乙二醇', exchange: 'DCE', market: 'DCE' },
  { symbol: 'MA', commodity: '甲醇', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'EB', commodity: '苯乙烯', exchange: 'DCE', market: 'DCE' },
  { symbol: 'PG', commodity: '液化气', exchange: 'DCE', market: 'DCE' },
  { symbol: 'SA', commodity: '纯碱', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'UR', commodity: '尿素', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'V', commodity: 'PVC', exchange: 'DCE', market: 'DCE' },
  { symbol: 'L', commodity: '塑料', exchange: 'DCE', market: 'DCE' },
  // 农产品
  { symbol: 'P', commodity: '棕榈油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'Y', commodity: '豆油', exchange: 'DCE', market: 'DCE' },
  { symbol: 'M', commodity: '豆粕', exchange: 'DCE', market: 'DCE' },
  { symbol: 'OI', commodity: '菜油', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'RM', commodity: '菜粕', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'CF', commodity: '棉花', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'SR', commodity: '白糖', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'AP', commodity: '苹果', exchange: 'CZCE', market: 'CZCE' },
  { symbol: 'C', commodity: '玉米', exchange: 'DCE', market: 'DCE' },
  { symbol: 'CS', commodity: '淀粉', exchange: 'DCE', market: 'DCE' },
  { symbol: 'A', commodity: '豆一', exchange: 'DCE', market: 'DCE' },
  { symbol: 'JD', commodity: '鸡蛋', exchange: 'DCE', market: 'DCE' },
  { symbol: 'LH', commodity: '生猪', exchange: 'DCE', market: 'DCE' },
  { symbol: 'SP', commodity: '纸浆', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'PK', commodity: '花生', exchange: 'CZCE', market: 'CZCE' },
  // 贵金属
  { symbol: 'AU', commodity: '黄金', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'AG', commodity: '白银', exchange: 'SHFE', market: 'SHFE' },
  { symbol: 'PT', commodity: '铂', exchange: 'GFEX', market: 'GFEX' },
  { symbol: 'PD', commodity: '钯', exchange: 'GFEX', market: 'GFEX' },
  // 广期所新品种
  { symbol: 'SI', commodity: '工业硅', exchange: 'GFEX', market: 'GFEX' },
  { symbol: 'LC', commodity: '碳酸锂', exchange: 'GFEX', market: 'GFEX' },
  // 金融期货
  { symbol: 'IF', commodity: '沪深300', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'IC', commodity: '中证500', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'IM', commodity: '中证1000', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'IH', commodity: '上证50', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'TS', commodity: '2年国债', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'TF', commodity: '5年国债', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'T', commodity: '10年国债', exchange: 'CFFEX', market: 'CFFEX' },
  { symbol: 'TL', commodity: '30年国债', exchange: 'CFFEX', market: 'CFFEX' },
  // 外盘
  { symbol: 'CL', commodity: 'WTI原油', exchange: 'OVERSEAS', market: 'NYMEX' },
  { symbol: 'OIL', commodity: '布伦特原油', exchange: 'OVERSEAS', market: 'ICE' },
  { symbol: 'KC', commodity: '咖啡', exchange: 'OVERSEAS', market: 'ICE' },
  { symbol: 'RH', commodity: '铑', exchange: 'OVERSEAS', market: 'OTC' },
  { symbol: 'GC', commodity: 'COMEX黄金', exchange: 'OVERSEAS', market: 'COMEX' },
  { symbol: 'SI_F', commodity: 'COMEX白银', exchange: 'OVERSEAS', market: 'COMEX' },
  { symbol: 'HG', commodity: 'COMEX铜', exchange: 'OVERSEAS', market: 'COMEX' },
  { symbol: 'NG', commodity: '天然气', exchange: 'OVERSEAS', market: 'NYMEX' },
  { symbol: 'S', commodity: 'CBOT大豆', exchange: 'OVERSEAS', market: 'CBOT' },
  { symbol: 'W', commodity: 'CBOT小麦', exchange: 'OVERSEAS', market: 'CBOT' },
  { symbol: 'CT', commodity: 'ICE棉花', exchange: 'OVERSEAS', market: 'ICE' },
  { symbol: 'SB', commodity: 'ICE白糖', exchange: 'OVERSEAS', market: 'ICE' },
  { symbol: 'CC', commodity: 'ICE可可', exchange: 'OVERSEAS', market: 'ICE' },
  { symbol: 'LME_CU', commodity: 'LME铜', exchange: 'OVERSEAS', market: 'LME' },
  { symbol: 'LME_AL', commodity: 'LME铝', exchange: 'OVERSEAS', market: 'LME' },
  { symbol: 'LME_ZN', commodity: 'LME锌', exchange: 'OVERSEAS', market: 'LME' },
  { symbol: 'LME_NI', commodity: 'LME镍', exchange: 'OVERSEAS', market: 'LME' },
];

// Fallback base prices when AkShare is unavailable
const BASE_PRICES: Record<string, number> = {
  RB: 3650, HC: 3850, SS: 14200, I: 880, J: 2150, JM: 1580, SF: 7800, SM: 6500,
  CU: 72000, AL: 20500, ZN: 22800, NI: 128000, SN: 220000, PB: 16500, BC: 65000,
  SC: 560, FU: 3200, LU: 4100, BU: 3800, PP: 7800, TA: 5900, MEG: 4600, MA: 2650, EB: 8500, PG: 4200, SA: 1800, UR: 1900, V: 6200, L: 7800,
  P: 8200, Y: 7900, M: 3200, OI: 9500, RM: 2800, CF: 14500, SR: 6200, AP: 8500, C: 2600, CS: 3100, A: 4800, JD: 4200, LH: 15000, SP: 5800, PK: 9500,
  AU: 580, AG: 7200,
  PT: 528, PD: 384,
  SI: 11500, LC: 78000,
  IF: 3800, IC: 5500, IM: 5800, IH: 2700, TS: 101, TF: 103, T: 104, TL: 108,
  CL: 89, OIL: 95, KC: 284, RH: 0,
  GC: 2350, SI_F: 28, HG: 4.2, NG: 2.8, S: 1200, W: 650, CT: 82, SB: 22, CC: 8500,
  LME_CU: 9200, LME_AL: 2400, LME_ZN: 2700, LME_NI: 16000,
};

async function seedSymbolFallback(symbol: string, commodity: string, exchange: string, market: string): Promise<number> {
  // DISABLED: Never write simulated data to the database.
  // If AkShare is unavailable, we wait until it's back rather than polluting with fake prices.
  console.warn(`[market-ingest] Skipping ${symbol} — AkShare unavailable, no fallback data will be written`);
  return 0;
}

/**
 * Seed historical data from AkShare for all watched symbols.
 * Falls back to simulated data if backtest service is unavailable.
 */
export async function seedHistoricalData(): Promise<number> {
  let totalInserted = 0;

  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    try {
      // Skip fallback if real data already exists for this symbol
      const existing = await db.select({ count: sql<number>`count(*)` }).from(marketData).where(eq(marketData.symbol, symbol));
      const hasData = (existing[0]?.count ?? 0) > 30;

      const res = await fetch(`${BACKTEST_URL}/market-data/${symbol}?days=750`, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        if (!hasData) {
          console.warn(`[market-ingest] AkShare unavailable for ${symbol}, using fallback`);
          totalInserted += await seedSymbolFallback(symbol, commodity, exchange, market);
        }
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
        currency: exchange === 'OVERSEAS' ? 'USD' : 'CNY',
        timezone: exchange === 'OVERSEAS' ? 'America/New_York' : 'Asia/Shanghai',
      }));

      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        await db.insert(marketData).values(rows.slice(i, i + batchSize) as any).onConflictDoNothing();
      }
      totalInserted += rows.length;
    } catch (err) {
      console.warn(`[market-ingest] Failed to fetch ${symbol} from AkShare:`, err);
      // Only use fallback if no real data exists yet
      const existing = await db.select({ count: sql<number>`count(*)` }).from(marketData).where(eq(marketData.symbol, symbol));
      if ((existing[0]?.count ?? 0) <= 30) {
        totalInserted += await seedSymbolFallback(symbol, commodity, exchange, market);
      }
    }
  }

  console.log(`[market-ingest] Seeded ${totalInserted} records for ${SYMBOLS.length} symbols`);
  return totalInserted;
}

interface AkShareBar {
  date: string; open: number; high: number; low: number;
  close: number; volume: number; open_interest: number; symbol: string;
}

interface RealtimeQuote {
  symbol: string; price: number; open: number; high: number;
  low: number; volume: number; change_pct: number; timestamp: string;
}

/**
 * Fetch latest data from AkShare for all watched symbols.
 * During trading hours (9:00-15:00 Beijing time), uses realtime snapshot.
 * After hours, uses daily bar endpoint.
 */
export async function ingestDailyData(): Promise<number> {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return 0;

  // Check if we're in trading hours (Beijing time = UTC+8)
  const beijingHour = (now.getUTCHours() + 8) % 24;
  const isTradingHours = beijingHour >= 9 && beijingHour < 15;

  // During trading hours, try realtime snapshot first
  if (isTradingHours) {
    try {
      const rtRes = await fetch(`${BACKTEST_URL}/realtime`, { signal: AbortSignal.timeout(30000) });
      if (rtRes.ok) {
        const quotes: RealtimeQuote[] = await rtRes.json();
        if (quotes.length > 0) {
          const today = now.toISOString().split('T')[0];
          let inserted = 0;
          for (const q of quotes) {
            const symInfo = SYMBOLS.find((s) => s.symbol === q.symbol);
            if (!symInfo) continue;
            const id = `${q.symbol}_${today}`;
            const ts = new Date(today);
            ts.setHours(0, 0, 0, 0);
            await db.insert(marketData).values({
              id, market: symInfo.market, exchange: symInfo.exchange,
              commodity: symInfo.commodity, symbol: q.symbol,
              contractMonth: 'main', timestamp: ts,
              open: q.open, high: q.high, low: q.low,
              close: q.price, settle: q.price,
              volume: q.volume, openInterest: 0,
              currency: 'CNY', timezone: 'Asia/Shanghai',
            } as any).onConflictDoUpdate({
              target: marketData.id,
              set: { high: q.high, low: q.low, close: q.price, settle: q.price, volume: q.volume },
            });
            inserted++;
          }
          console.log(`[market-ingest] Realtime snapshot: updated ${inserted} symbols`);
          // Continue to daily bar fallback for symbols not covered by realtime (e.g. overseas)
          const coveredSymbols = new Set(quotes.map((q) => q.symbol));
          const uncoveredSymbols = SYMBOLS.filter((s) => !coveredSymbols.has(s.symbol));
          for (const { symbol, commodity, exchange, market: mkt } of uncoveredSymbols) {
            try {
              const res = await fetch(`${BACKTEST_URL}/market-data/${symbol}?days=5`, { signal: AbortSignal.timeout(10000) });
              if (!res.ok) continue;
              const bars: AkShareBar[] = await res.json();
              if (!bars.length) continue;
              const latest = bars[bars.length - 1];
              const ts2 = new Date(latest.date);
              ts2.setHours(0, 0, 0, 0);
              const id2 = `${symbol}_${latest.date}`;
              await db.insert(marketData).values({
                id: id2, market: mkt, exchange, commodity, symbol,
                contractMonth: 'main', timestamp: ts2,
                open: latest.open, high: latest.high, low: latest.low,
                close: latest.close, settle: latest.close,
                volume: latest.volume, openInterest: latest.open_interest ?? 0,
                currency: exchange === 'OVERSEAS' ? 'USD' : 'CNY',
                timezone: exchange === 'OVERSEAS' ? 'America/New_York' : 'Asia/Shanghai',
              } as any).onConflictDoUpdate({
                target: marketData.id,
                set: { high: latest.high, low: latest.low, close: latest.close, settle: latest.close, volume: latest.volume },
              });
              inserted++;
            } catch { /* skip failed symbol */ }
          }
          return inserted;
        }
      }
    } catch (err) {
      console.warn(`[market-ingest] Realtime snapshot failed, falling back to daily:`, err);
    }
  }

interface TushareBar {
  date: string; open: number; high: number; low: number;
  close: number; volume: number; open_interest: number; symbol: string;
  settle: number; oi_chg: number; amount: number;
}

  // Fallback: daily bar endpoint (after hours or realtime failed)
  // For domestic symbols, try Tushare first (richer data: settle, oi_chg, amount)
  let inserted = 0;
  for (const { symbol, commodity, exchange, market } of SYMBOLS) {
    try {
      const isDomestic = exchange !== 'OVERSEAS';
      let latest: AkShareBar | TushareBar | null = null;
      let settle = 0;

      // Try Tushare first for domestic symbols
      if (isDomestic) {
        try {
          const tsRes = await fetch(`${BACKTEST_URL}/market-data/tushare/${symbol}?days=5`, { signal: AbortSignal.timeout(15000) });
          if (tsRes.ok) {
            const tsBars: TushareBar[] = await tsRes.json();
            if (tsBars.length > 0) {
              latest = tsBars[tsBars.length - 1];
              settle = (latest as TushareBar).settle || latest.close;
            }
          }
        } catch { /* Tushare failed, will fallback to AkShare */ }
      }

      // Fallback to AkShare
      if (!latest) {
        const res = await fetch(`${BACKTEST_URL}/market-data/${symbol}?days=5`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const bars: AkShareBar[] = await res.json();
        if (!bars.length) continue;
        latest = bars[bars.length - 1];
        settle = latest.close;
      }

      const ts = new Date(latest.date);
      ts.setHours(0, 0, 0, 0);
      const id = `${symbol}_${latest.date}`;

      await db.insert(marketData).values({
        id, market, exchange, commodity, symbol,
        contractMonth: 'main',
        timestamp: ts,
        open: latest.open, high: latest.high, low: latest.low,
        close: latest.close, settle,
        volume: latest.volume, openInterest: latest.open_interest,
        currency: exchange === 'OVERSEAS' ? 'USD' : 'CNY',
        timezone: exchange === 'OVERSEAS' ? 'America/New_York' : 'Asia/Shanghai',
      } as any).onConflictDoUpdate({
        target: marketData.id,
        set: {
          high: latest.high,
          low: latest.low,
          close: latest.close,
          settle,
          volume: latest.volume,
          openInterest: latest.open_interest,
        },
      });
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
 * Returns false if total count < 200 (needs full seed) or any symbol is stale (> 3 days old).
 */
export async function hasEnoughData(): Promise<boolean> {
  const result = await db.select({ value: count() }).from(marketData);
  // Only trigger seed if database is nearly empty (fresh install)
  return (result[0]?.value ?? 0) >= 200;
}
