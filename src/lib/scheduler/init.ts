import { scheduler } from './manager';

export function initScheduler() {
  if (process.env.NODE_ENV === 'test') return;
  scheduler.init();

  // Initialize Weaviate schema (non-blocking)
  initWeaviate().catch((err) => console.error('[Scheduler] Weaviate init failed (non-critical):', err));

  // Auto-seed market data if empty, then trigger first analysis round
  autoSeedIfNeeded().catch((err) => console.error('[Scheduler] Auto-seed failed:', err));
}

async function initWeaviate() {
  const { ensureMemorySchema } = await import('@/lib/memory/schema');
  await ensureMemorySchema();
  console.log('[Scheduler] Weaviate memory schema initialized.');
}

async function autoSeedIfNeeded() {
  const { hasEnoughData, seedHistoricalData } = await import('@/lib/data-sources/market-ingest');
  const enough = await hasEnoughData();
  if (!enough) {
    console.log('[Scheduler] market_data is empty, seeding historical data...');
    await seedHistoricalData();
    console.log('[Scheduler] Seed complete. Triggering initial analysis...');
    // Run context → alerts in sequence so alerts have context
    await scheduler.runNow('context');
    await scheduler.runNow('alerts');
    console.log('[Scheduler] Initial analysis round complete.');
  }
}
