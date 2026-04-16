import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marketData, alerts, positions, accountSnapshots } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { Alert, AlertType, AlertCategory, Recommendation } from '@/types/domain';
import { getEvaluators, getAllEvaluators } from '@/lib/trigger';
import type { TriggerContext } from '@/lib/trigger';
import { applyPositionFilters } from '@/lib/trigger/position-filter';
import { serializeRecord } from '@/lib/serialize';

// POST /api/alerts/trigger - Trigger alert evaluation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol1,
      symbol2,
      alertTypes,
      window = 20,
      category = 'ferrous',
    } = body as {
      symbol1: string;
      symbol2?: string;
      alertTypes?: AlertType[];
      window?: number;
      category?: AlertCategory;
    };

    if (!symbol1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'symbol1 is required' },
        },
        { status: 400 }
      );
    }

    // Query market data for symbol1
    const data1 = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol1))
      .orderBy(desc(marketData.timestamp))
      .limit(Math.max(window, 20));

    if (data1.length < window) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_DATA',
            message: `Need at least ${window} data points for ${symbol1}`,
          },
        },
        { status: 400 }
      );
    }

    // Query market data for symbol2 if provided
    let data2: typeof data1 = [];
    let spreadStats = null;

    if (symbol2) {
      data2 = await db
        .select()
        .from(marketData)
        .where(eq(marketData.symbol, symbol2))
        .orderBy(desc(marketData.timestamp))
        .limit(Math.max(window, 20));

      if (data2.length < window) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_DATA',
              message: `Need at least ${window} data points for ${symbol2}`,
            },
          },
          { status: 400 }
        );
      }

      // Calculate spread statistics
      const tsMap2 = new Map(data2.map((r) => [r.timestamp.getTime(), r.close]));
      const spreads: number[] = [];

      for (const r1 of data1) {
        const c2 = tsMap2.get(r1.timestamp.getTime());
        if (c2 !== undefined) {
          spreads.push(r1.close - c2);
        }
      }

      if (spreads.length >= window) {
        const n = spreads.length;
        const mean = spreads.reduce((a, b) => a + b, 0) / n;
        const variance = spreads.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
        const stdDev = Math.sqrt(variance);
        const currentSpread = spreads[0];
        const currentZScore = stdDev > 0 ? (currentSpread - mean) / stdDev : 0;
        const halfLife = Math.log(2) / Math.log(1 + 2 / (window + 1));
        const adfPValue = Math.max(0.01, Math.min(0.99, 1 - Math.abs(currentZScore) / 5));

        spreadStats = {
          symbol1,
          symbol2,
          window: spreads.length,
          spreadMean: mean,
          spreadStdDev: stdDev,
          currentZScore,
          halfLife,
          adfPValue,
          sampleCount: spreads.length,
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

    const context: TriggerContext = {
      symbol1,
      symbol2,
      category,
      marketData: data1.map((d) => ({
        ...d,
        timestamp: d.timestamp.toISOString(),
      })),
      spreadStats: spreadStats || undefined,
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

    // Derive proposed legs from the symbol pair for position-aware filtering
    const proposedLegs: Array<{ asset: string; direction: "long" | "short"; size: number }> = [];
    if (symbol2 && spreadStats) {
      // Spread alert: long one leg, short the other
      // Direction: if z-score is high positive, short the expensive leg (spread will compress)
      const direction: "long" | "short" = spreadStats.currentZScore > 0 ? "short" : "long";
      proposedLegs.push(
        { asset: symbol1, direction: direction === "long" ? "long" : "short", size: 1 },
        { asset: symbol2, direction: direction === "long" ? "short" : "long", size: 1 }
      );
    } else {
      // Single-symbol alert: directional
      proposedLegs.push({ asset: symbol1, direction: "long", size: 1 });
    }

    const filterResult = applyPositionFilters(
      proposedLegs.map((l) => ({ ...l, marginEstimate: 0 })),
      category,
      context
    );

    // Get evaluators
    const evaluators = alertTypes ? getEvaluators(alertTypes) : getAllEvaluators();

    // Evaluate triggers
    const triggeredAlerts: Alert[] = [];
    const generatedRecommendations: Recommendation[] = [];

    for (const evaluator of evaluators) {
      try {
        const result = await evaluator.evaluate(context);

        if (result && result.triggered) {
          // Create alert
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

          const [alert] = await db
            .insert(alerts)
            .values({
              title: result.title,
              summary: result.summary,
              severity: result.severity,
              category,
              type: evaluator.type,
              status: 'active',
              triggeredAt: now,
              updatedAt: now,
              expiresAt,
              confidence: result.confidence,
              relatedAssets: result.relatedAssets,
              spreadInfo: result.spreadInfo || null,
              triggerChain: result.triggerChain,
              riskItems: [...result.riskItems, ...filterResult.riskItems],
              manualCheckItems: result.manualCheckItems,
            })
            .returning();

          triggeredAlerts.push(serializeRecord<Alert>(alert));

          // Generate recommendation if spread_anomaly or basis_shift
          if (evaluator.type === 'spread_anomaly' || evaluator.type === 'basis_shift') {
            try {
              const candidateResponse = await fetch(
                `${request.nextUrl.origin}/api/candidates/generate`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ alertId: alert.id }),
                }
              );

              if (candidateResponse.ok) {
                const candidateData = await candidateResponse.json();
                if (candidateData.success && candidateData.data.recommendation) {
                  generatedRecommendations.push(candidateData.data.recommendation);
                }
              }
            } catch (err) {
              console.error('Failed to generate recommendation:', err);
            }
          }
        }
      } catch (err) {
        console.error(`Evaluator ${evaluator.type} failed:`, err);
        // Continue with other evaluators
      }
    }

    const response: ApiResponse<{ alerts: Alert[]; recommendations: Recommendation[] }> = {
      success: true,
      data: {
        alerts: triggeredAlerts,
        recommendations: generatedRecommendations,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/alerts/trigger error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to trigger alerts',
        },
      },
      { status: 500 }
    );
  }
}
