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

// Cron watchlist: symbol pairs and categories to monitor
const CRON_WATCHLIST: Array<{ symbol1: string; symbol2?: string; category: AlertCategory }> = [
  { symbol1: 'RB2506', symbol2: 'HC2506', category: 'ferrous' },
  { symbol1: 'CU2506', symbol2: 'AL2506', category: 'nonferrous' },
  { symbol1: 'RB2506', category: 'ferrous' },
  { symbol1: 'HC2506', category: 'ferrous' },
  { symbol1: 'CU2506', category: 'nonferrous' },
];

const WINDOW = 60;

// POST /api/alerts/cron - Scheduled alert trigger (called by cron job)
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authError = verifyCronSecret(request);
  if (authError) return authError;

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

  if (data1.length < WINDOW) {
    return { triggered: false, count: 0, error: `Insufficient data for ${symbol1}` };
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

    if (data2.length < WINDOW) {
      return { triggered: false, count: 0, error: `Insufficient data for ${symbol2}` };
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

    if (closes1.length >= WINDOW) {
      // Engle-Granger cointegration test
      const eg = engleGranger(closes1, closes2);
      const spreads = eg.residuals.length > 0
        ? eg.residuals
        : closes1.map((c, i) => c - closes2[i]);

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
      };
    }
  }

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

  // Ensemble: aggregate, boost resonance, dampen conflicts
  const ensemble = ensembleSignals(evalResults);

  for (const alert of ensemble.alerts) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
