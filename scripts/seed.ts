import { db } from '../src/db';
import { marketData } from '../src/db/schema';

/**
 * Seed script for market data
 * Generates sample OHLCV data for testing
 */

async function seedMarketData() {
  console.log('🌱 Seeding market data...');

  const symbols = [
    { symbol: 'RB2506', commodity: '螺纹钢', exchange: 'SHFE', market: 'SHFE' },
    { symbol: 'HC2506', commodity: '热卷', exchange: 'SHFE', market: 'SHFE' },
    { symbol: 'CU2506', commodity: '铜', exchange: 'SHFE', market: 'SHFE' },
    { symbol: 'AL2506', commodity: '铝', exchange: 'SHFE', market: 'SHFE' },
    { symbol: 'ZN2506', commodity: '锌', exchange: 'SHFE', market: 'SHFE' },
  ];

  const dataPoints: any[] = [];
  const now = new Date();
  const daysToGenerate = 60; // 60 trading days

  for (const { symbol, commodity, exchange, market } of symbols) {
    let basePrice = 3500 + Math.random() * 1000; // Random base price

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(15, 0, 0, 0); // 3 PM close

      // Generate realistic OHLCV data
      const dailyChange = (Math.random() - 0.5) * 100; // ±50 price change
      const open = basePrice;
      const close = basePrice + dailyChange;
      const high = Math.max(open, close) + Math.random() * 30;
      const low = Math.min(open, close) - Math.random() * 30;
      const settle = close + (Math.random() - 0.5) * 10;
      const volume = Math.floor(50000 + Math.random() * 100000);
      const openInterest = Math.floor(200000 + Math.random() * 300000);

      dataPoints.push({
        id: `${symbol}_${date.toISOString()}`,
        market,
        exchange,
        commodity,
        symbol,
        contractMonth: '2506',
        timestamp: date,
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        settle: Math.round(settle),
        volume,
        openInterest,
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
      });

      basePrice = close; // Next day starts at previous close
    }
  }

  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < dataPoints.length; i += batchSize) {
    const batch = dataPoints.slice(i, i + batchSize);
    await db.insert(marketData).values(batch);
    console.log(`  Inserted ${Math.min(i + batchSize, dataPoints.length)}/${dataPoints.length} records`);
  }

  console.log('✅ Market data seeded successfully');
}

async function main() {
  try {
    await seedMarketData();
    console.log('🎉 All seed data inserted');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
