import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData, alerts, positions, accountSnapshots } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { Alert, AlertCategory } from '@/types/domain';
import { getAllEvaluators } from '@/lib/trigger';
import type { TriggerContext, SpreadStatistics } from '@/lib/trigger';
import { applyPositionFilters } from '@/lib/trigger/position-filter';
import { ensembleSignals } from '@/lib/trigger/ensemble';
import { serializeRecord } from '@/lib/serialize';
import { verifyCronSecret } from '@/lib/auth';
import { engleGranger, ouHalfLife, hurstExponent as calcHurst } from '@/lib/stats/cointegration';
import { recordSignal } from '@/lib/trigger/signal-quality';
import { getSignalHitRates } from '@/lib/trigger/signal-quality';
import { generateOneLiner } from '@/lib/reasoning/one-liner';
import { runOrchestration } from '@/lib/pipeline/orchestrator';

async function triggerOrchestrationAsync() {
  console.log('[cron] Auto-triggering orchestration for new alerts...');
  const result = await runOrchestration();
  console.log(`[cron] Orchestration complete: ${result.recommendationsCreated} recommendations created`);
}

// Cron watchlist: symbol pairs and categories to monitor
const CRON_WATCHLIST: Array<{ symbol1: string; symbol2?: string; category: AlertCategory }> = [
  // 黑色 — 套利对
  { symbol1: 'RB', symbol2: 'HC', category: 'ferrous' },
  { symbol1: 'I', symbol2: 'J', category: 'ferrous' },
  { symbol1: 'JM', symbol2: 'J', category: 'ferrous' },
  { symbol1: 'RB', symbol2: 'I', category: 'ferrous' },
  { symbol1: 'SF', symbol2: 'SM', category: 'ferrous' },
  // 黑色 — 单品种
  { symbol1: 'RB', category: 'ferrous' },
  { symbol1: 'HC', category: 'ferrous' },
  { symbol1: 'SS', category: 'ferrous' },
  { symbol1: 'I', category: 'ferrous' },
  { symbol1: 'J', category: 'ferrous' },
  { symbol1: 'JM', category: 'ferrous' },
  { symbol1: 'SF', category: 'ferrous' },
  { symbol1: 'SM', category: 'ferrous' },
  // 有色 — 套利对
  { symbol1: 'CU', symbol2: 'AL', category: 'nonferrous' },
  { symbol1: 'CU', symbol2: 'ZN', category: 'nonferrous' },
  { symbol1: 'NI', symbol2: 'SN', category: 'nonferrous' },
  { symbol1: 'ZN', symbol2: 'PB', category: 'nonferrous' },
  // 有色 — 单品种
  { symbol1: 'CU', category: 'nonferrous' },
  { symbol1: 'AL', category: 'nonferrous' },
  { symbol1: 'ZN', category: 'nonferrous' },
  { symbol1: 'NI', category: 'nonferrous' },
  { symbol1: 'SN', category: 'nonferrous' },
  { symbol1: 'PB', category: 'nonferrous' },
  // 能化 — 套利对
  { symbol1: 'SC', symbol2: 'FU', category: 'energy' },
  { symbol1: 'SC', symbol2: 'LU', category: 'energy' },
  { symbol1: 'TA', symbol2: 'MEG', category: 'energy' },
  { symbol1: 'PP', symbol2: 'L', category: 'energy' },
  { symbol1: 'EB', symbol2: 'TA', category: 'energy' },
  { symbol1: 'MA', symbol2: 'MEG', category: 'energy' },
  // 能化 — 单品种
  { symbol1: 'SC', category: 'energy' },
  { symbol1: 'FU', category: 'energy' },
  { symbol1: 'LU', category: 'energy' },
  { symbol1: 'BU', category: 'energy' },
  { symbol1: 'PP', category: 'energy' },
  { symbol1: 'TA', category: 'energy' },
  { symbol1: 'MEG', category: 'energy' },
  { symbol1: 'MA', category: 'energy' },
  { symbol1: 'EB', category: 'energy' },
  { symbol1: 'PG', category: 'energy' },
  { symbol1: 'SA', category: 'energy' },
  { symbol1: 'UR', category: 'energy' },
  { symbol1: 'V', category: 'energy' },
  { symbol1: 'L', category: 'energy' },
  // 农产品 — 套利对
  { symbol1: 'P', symbol2: 'Y', category: 'agriculture' },
  { symbol1: 'M', symbol2: 'RM', category: 'agriculture' },
  { symbol1: 'Y', symbol2: 'OI', category: 'agriculture' },
  { symbol1: 'C', symbol2: 'CS', category: 'agriculture' },
  { symbol1: 'CF', symbol2: 'SR', category: 'agriculture' },
  // 农产品 — 单品种
  { symbol1: 'P', category: 'agriculture' },
  { symbol1: 'Y', category: 'agriculture' },
  { symbol1: 'M', category: 'agriculture' },
  { symbol1: 'OI', category: 'agriculture' },
  { symbol1: 'RM', category: 'agriculture' },
  { symbol1: 'CF', category: 'agriculture' },
  { symbol1: 'SR', category: 'agriculture' },
  { symbol1: 'AP', category: 'agriculture' },
  { symbol1: 'C', category: 'agriculture' },
  { symbol1: 'CS', category: 'agriculture' },
  { symbol1: 'JD', category: 'agriculture' },
  { symbol1: 'LH', category: 'agriculture' },
  { symbol1: 'SP', category: 'agriculture' },
  { symbol1: 'PK', category: 'agriculture' },
  // 贵金属 — 套利对
  { symbol1: 'AU', symbol2: 'AG', category: 'nonferrous' },
  // 贵金属 — 单品种
  { symbol1: 'AU', category: 'nonferrous' },
  { symbol1: 'AG', category: 'nonferrous' },
  // 广期所 — 套利对
  { symbol1: 'SI', symbol2: 'SA', category: 'energy' },
  { symbol1: 'LC', symbol2: 'NI', category: 'nonferrous' },
  // 广期所 — 单品种
  { symbol1: 'SI', category: 'energy' },
  { symbol1: 'LC', category: 'nonferrous' },
  // 金融期货 — 套利对
  { symbol1: 'IF', symbol2: 'IH', category: 'financial' },
  { symbol1: 'IF', symbol2: 'IC', category: 'financial' },
  { symbol1: 'IC', symbol2: 'IM', category: 'financial' },
  { symbol1: 'T', symbol2: 'TF', category: 'financial' },
  { symbol1: 'TF', symbol2: 'TS', category: 'financial' },
  // 金融期货 — 单品种
  { symbol1: 'IF', category: 'financial' },
  { symbol1: 'IC', category: 'financial' },
  { symbol1: 'IM', category: 'financial' },
  { symbol1: 'IH', category: 'financial' },
  { symbol1: 'TS', category: 'financial' },
  { symbol1: 'TF', category: 'financial' },
  { symbol1: 'T', category: 'financial' },
  { symbol1: 'TL', category: 'financial' },
  // 内外盘价差套利
  { symbol1: 'AU', symbol2: 'GC', category: 'nonferrous' },
  { symbol1: 'CU', symbol2: 'HG', category: 'nonferrous' },
  { symbol1: 'SC', symbol2: 'CL', category: 'energy' },
  { symbol1: 'CF', symbol2: 'CT', category: 'agriculture' },
  { symbol1: 'SR', symbol2: 'SB', category: 'agriculture' },
  { symbol1: 'CU', symbol2: 'LME_CU', category: 'nonferrous' },
  { symbol1: 'AL', symbol2: 'LME_AL', category: 'nonferrous' },
  // 外盘 — 单品种
  { symbol1: 'GC', category: 'overseas' },
  { symbol1: 'SI_F', category: 'overseas' },
  { symbol1: 'HG', category: 'overseas' },
  { symbol1: 'NG', category: 'overseas' },
  { symbol1: 'S', category: 'overseas' },
  { symbol1: 'W', category: 'overseas' },
  { symbol1: 'CT', category: 'overseas' },
  { symbol1: 'SB', category: 'overseas' },
  { symbol1: 'CC', category: 'overseas' },
  { symbol1: 'LME_CU', category: 'overseas' },
  { symbol1: 'LME_AL', category: 'overseas' },
  { symbol1: 'LME_ZN', category: 'overseas' },
  { symbol1: 'LME_NI', category: 'overseas' },
];

const WINDOW = 250;
const WINDOW_FALLBACK = 60;

// POST /api/alerts/cron - Scheduled alert trigger (called by cron job)
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // Global data circuit breaker: skip entire run if data is stale (>48h)
  try {
    const [latestRow] = await db
      .select({ ts: marketData.timestamp })
      .from(marketData)
      .orderBy(desc(marketData.timestamp))
      .limit(1);
    const latestTs = latestRow?.ts?.getTime() ?? 0;
    const ageHours = (Date.now() - latestTs) / (1000 * 60 * 60);
    if (ageHours > 48) {
      console.warn(`[cron] Circuit breaker: market data is ${ageHours.toFixed(0)}h stale, skipping alert run`);
      return NextResponse.json({
        success: false,
        data: { circuitBreaker: true, reason: `Market data stale: ${ageHours.toFixed(0)}h old`, timestamp: new Date().toISOString() },
      });
    }
  } catch (err) {
    console.error('[cron] Circuit breaker check failed:', err);
  }

  const results: Array<{
    symbol1: string;
    symbol2?: string;
    category: AlertCategory;
    triggered: boolean;
    count: number;
    error?: string;
  }> = [];

  for (const watch of CRON_WATCHLIST) {
    try {
      const result = await triggerForPair(watch.symbol1, watch.symbol2, watch.category);
      results.push({ ...watch, ...result });
    } catch (err) {
      console.error(`Cron trigger failed for ${watch.symbol1}/${watch.symbol2}:`, err);
      results.push({
        ...watch,
        triggered: false,
        count: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const totalTriggered = results.reduce((sum, r) => sum + r.count, 0);

  // Auto-trigger orchestration if any critical/high alerts were generated
  if (totalTriggered > 0) {
    triggerOrchestrationAsync().catch((err) =>
      console.error('[cron] Auto-orchestration failed:', err)
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      pairs: results.length,
      totalAlerts: totalTriggered,
      results,
    },
  });
}

async function triggerForPair(
  symbol1: string,
  symbol2: string | undefined,
  category: AlertCategory
): Promise<{ triggered: boolean; count: number; error?: string }> {
  // Query market data for symbol1
  const data1 = await db
    .select()
    .from(marketData)
    .where(eq(marketData.symbol, symbol1))
    .orderBy(desc(marketData.timestamp))
    .limit(WINDOW);

  // Require at least WINDOW_FALLBACK data points (prefer WINDOW)
  if (data1.length < WINDOW_FALLBACK) {
    return { triggered: false, count: 0, error: `Insufficient data for ${symbol1} (${data1.length}/${WINDOW_FALLBACK})` };
  }

  // Data freshness check: skip if latest data is older than 3 days (stale ingest)
  const latestTs = data1[0]?.timestamp?.getTime() ?? 0;
  const staleCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  if (latestTs < staleCutoff) {
    return { triggered: false, count: 0, error: `Stale data for ${symbol1}: latest is ${new Date(latestTs).toISOString().split('T')[0]}` };
  }

  // Query market data for symbol2 if provided
  let data2: typeof data1 = [];
  let spreadStats: SpreadStatistics | undefined;

  if (symbol2) {
    data2 = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol2))
      .orderBy(desc(marketData.timestamp))
      .limit(WINDOW);

    if (data2.length < WINDOW_FALLBACK) {
      return { triggered: false, count: 0, error: `Insufficient data for ${symbol2} (${data2.length}/${WINDOW_FALLBACK})` };
    }

    // Calculate spread statistics with real cointegration tests
    const tsMap2 = new Map(data2.map((r) => [r.timestamp.getTime(), r.close]));
    const closes1: number[] = [];
    const closes2: number[] = [];

    for (const r1 of data1) {
      const c2 = tsMap2.get(r1.timestamp.getTime());
      if (c2 !== undefined) {
        closes1.push(r1.close);
        closes2.push(c2);
      }
    }

    // Reverse to time-ascending order for regression
    closes1.reverse();
    closes2.reverse();

    if (closes1.length >= WINDOW_FALLBACK) {
      // Raw spread statistics (for display: historicalMean, sigma bands)
      const rawSpreads = closes1.map((c, i) => c - closes2[i]);
      const rawN = rawSpreads.length;
      const rawMean = rawSpreads.reduce((a, b) => a + b, 0) / rawN;
      const rawStdDev = Math.sqrt(rawSpreads.reduce((a, b) => a + (b - rawMean) ** 2, 0) / rawN);

      // Engle-Granger cointegration test (residuals for z-score / stationarity)
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

      // Real OU half-life from AR(1) fit
      const ou = ouHalfLife(spreads);

      // Real Hurst exponent from R/S analysis
      const hurst = calcHurst(spreads);

      spreadStats = {
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
    }
  }

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL || 'http://localhost:8100';

  // Fetch industry data (inventory) for inventory-shock detector
  let industryData: { inventory?: Array<{ value: number; date: string }>; spotPrice?: number } | undefined;
  try {
    const invRes = await fetch(`${BACKTEST_URL}/industry/inventory/${symbol1}?limit=30`, { signal: AbortSignal.timeout(5000) });
    if (invRes.ok) {
      const invData = await invRes.json();
      if (Array.isArray(invData) && invData.length > 0) {
        industryData = { inventory: invData.map((d: any) => ({ value: d.value, date: d.date })) };
      }
    }
  } catch { /* inventory data is optional */ }

  // Build trigger context with position awareness
  const openPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.status, "open"))
    .limit(100);

  const latestSnapshot = await db
    .select()
    .from(accountSnapshots)
    .orderBy(desc(accountSnapshots.snapshotAt))
    .limit(1);

  const accountSnapshot = latestSnapshot[0]
    ? {
        netValue: latestSnapshot[0].netValue,
        availableMargin: latestSnapshot[0].availableMargin,
        marginUtilizationRate: latestSnapshot[0].marginUtilizationRate,
        totalUnrealizedPnl: latestSnapshot[0].totalUnrealizedPnl,
        todayRealizedPnl: latestSnapshot[0].todayRealizedPnl,
        snapshotAt: latestSnapshot[0].snapshotAt.toISOString(),
      }
    : undefined;

  // Derive proposed legs from the symbol pair for position-aware filtering
  const proposedLegs: Array<{ asset: string; direction: "long" | "short"; size: number }> = [];
  if (symbol2 && spreadStats) {
    const direction: "long" | "short" = spreadStats.currentZScore > 0 ? "short" : "long";
    proposedLegs.push(
      { asset: symbol1, direction: direction === "long" ? "long" : "short", size: 1 },
      { asset: symbol2, direction: direction === "long" ? "short" : "long", size: 1 }
    );
  } else {
    proposedLegs.push({ asset: symbol1, direction: "long", size: 1 });
  }

  // Build trigger context
  const context: TriggerContext = {
    symbol1,
    symbol2,
    category,
    marketData: data1.map((d) => ({
      ...d,
      timestamp: d.timestamp.toISOString(),
    })),
    spreadStats,
    positions: openPositions.map((p) => ({
      id: p.id,
      strategyId: p.strategyId ?? undefined,
      strategyName: p.strategyName ?? undefined,
      recommendationId: p.recommendationId ?? undefined,
      legs: p.legs,
      openedAt: p.openedAt.toISOString(),
      entrySpread: p.entrySpread,
      currentSpread: p.currentSpread,
      spreadUnit: p.spreadUnit,
      unrealizedPnl: p.unrealizedPnl,
      totalMarginUsed: p.totalMarginUsed,
      exitCondition: p.exitCondition,
      targetZScore: p.targetZScore,
      currentZScore: p.currentZScore,
      halfLifeDays: p.halfLifeDays,
      daysHeld: p.daysHeld,
      status: p.status as "open" | "closed" | "partially_closed",
    })),
    accountSnapshot,
    industryData,
    timestamp: new Date().toISOString(),
  };

  const filterResult = applyPositionFilters(
    proposedLegs.map((l) => ({ ...l, marginEstimate: 0 })),
    category,
    context
  );

  // Evaluate all triggers and run ensemble
  const evaluators = getAllEvaluators();
  let alertCount = 0;

  const evalResults: Array<{ type: typeof evaluators[number]["type"]; result: NonNullable<Awaited<ReturnType<typeof evaluators[number]["evaluate"]>>> }> = [];

  for (const evaluator of evaluators) {
    try {
      const result = await evaluator.evaluate(context);
      if (result && result.triggered) {
        evalResults.push({ type: evaluator.type, result });
      }
    } catch (err) {
      console.error(`Evaluator ${evaluator.type} failed:`, err);
    }
  }

  // Fetch historical hit rates for ensemble weighting
  const hitRates = await getSignalHitRates(category).catch(() => []);

  // Ensemble: aggregate, boost resonance, dampen conflicts
  const ensemble = ensembleSignals(evalResults, hitRates);

  for (const alert of ensemble.alerts) {
    try {
      const now = new Date();
      const dedupWindow = new Date(now.getTime() - 8 * 60 * 60 * 1000);
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Dedup: skip if same type + same assets already active within 8h
      // Exception: allow if new z-score is significantly stronger (upgrade)
      const assetsKey = alert.result.relatedAssets.slice().sort().join(',');
      const recentSameType = await db.select({ relatedAssets: alerts.relatedAssets, spreadInfo: alerts.spreadInfo }).from(alerts)
        .where(and(
          eq(alerts.type, alert.type),
          eq(alerts.status, 'active'),
          gte(alerts.triggeredAt, dedupWindow),
        ))
        .limit(50);
      const newZ = Math.abs(alert.result.spreadInfo?.zScore ?? 0);
      const hasDuplicate = recentSameType.some((row) => {
        const rowKey = (row.relatedAssets as string[]).slice().sort().join(',');
        if (rowKey !== assetsKey) return false;
        // Allow upgrade: if new z-score is 0.5+ stronger, don't dedup
        const existingZ = Math.abs((row.spreadInfo as any)?.zScore ?? 0);
        if (newZ > existingZ + 0.5) return false;
        return true;
      });
      if (hasDuplicate) {
        console.log(`[cron] Skipped duplicate ${alert.type} alert for ${assetsKey}`);
        continue;
      }

      const [inserted] = await db.insert(alerts).values({
        title: alert.result.title,
        summary: alert.result.summary,
        severity: alert.result.severity,
        category,
        type: alert.type,
        status: 'active',
        triggeredAt: now,
        updatedAt: now,
        expiresAt,
        confidence: alert.result.confidence,
        relatedAssets: alert.result.relatedAssets,
        spreadInfo: alert.result.spreadInfo || null,
        triggerChain: alert.result.triggerChain,
        riskItems: [...alert.result.riskItems, ...filterResult.riskItems],
        manualCheckItems: alert.result.manualCheckItems,
      }).returning({ id: alerts.id });

      // Generate one-liner summary asynchronously
      generateOneLiner("alert", alert.result.summary)
        .then((oneLiner) =>
          db.update(alerts).set({ oneLiner }).where(eq(alerts.id, inserted.id))
        )
        .catch((err) => console.error(`One-liner generation failed:`, err));

      // Track signal for historical hit rate analysis
      recordSignal({
        alertId: inserted.id,
        signalType: alert.type,
        category,
        confidence: alert.result.confidence,
        zScore: spreadStats?.currentZScore,
      }).catch((err) => console.error(`Signal tracking failed:`, err));

      alertCount++;
      console.log(`[cron] Triggered ${alert.type} alert for ${symbol1}/${symbol2}: ${alert.result.title} (ensemble: ${ensemble.signalCount} signals, conf: ${ensemble.ensembleConfidence.toFixed(2)})`);
    } catch (err) {
      console.error(`Failed to insert alert for ${alert.type}:`, err);
    }
  }

  if (ensemble.suppressed.length > 0) {
    console.log(`[cron] Suppressed ${ensemble.suppressed.length} low-confidence signals for ${symbol1}/${symbol2}`);
  }

  return { triggered: alertCount > 0, count: alertCount };
}
