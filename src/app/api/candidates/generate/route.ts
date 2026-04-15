import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { candidateRequests } from '@/db/schema';
import { recommendations } from '@/db/schema';
import { alerts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { CandidateRequest, Recommendation } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// POST /api/candidates/generate - Generate recommendation from alert or strategy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, strategyId } = body as { alertId?: string; strategyId?: string };

    if (!alertId && !strategyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'alertId or strategyId is required',
          },
        },
        { status: 400 }
      );
    }

    // Fetch alert if provided
    let alertData: any = null;
    if (alertId) {
      const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
      alertData = alert;
    }

    // Compute scores
    let priorityScore = 50;
    let marginRequired = 100_000;
    let reasoning = '';

    if (alertData) {
      const { spreadInfo, triggerChain, confidence } = alertData;
      const severityScore = alertData.severity === 'critical' ? 40 : alertData.severity === 'high' ? 30 : alertData.severity === 'medium' ? 15 : 5;
      priorityScore = Math.round(severityScore + (confidence ?? 0.5) * 40);
      marginRequired = spreadInfo?.sigma1Upper
        ? Math.abs(spreadInfo.currentSpread - spreadInfo.historicalMean) * 10_000
        : 100_000;

      const stepCount = triggerChain?.length ?? 0;
      const confidenceLevel = confidence ?? 0.5;
      reasoning = `预警 "${alertData.title}" 由 ${stepCount} 个步骤触发，置信度 ${(confidenceLevel * 100).toFixed(0)}%，类型: ${alertData.type}。`;

      if (spreadInfo) {
        reasoning += `跨品种价差 Z-score ${spreadInfo.zScore.toFixed(2)}，均值回归半衰期 ${spreadInfo.halfLife} 天。`;
      }
    }

    const marginEfficiencyScore = Math.min(100, Math.round((1_000_000 / Math.max(marginRequired, 1000)) * 10));
    const portfolioFitScore = Math.min(100, Math.round(priorityScore * 0.6 + marginEfficiencyScore * 0.4));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

    // Create recommendation
    const [recommendation] = await db
      .insert(recommendations)
      .values({
        strategyId: strategyId ?? null,
        alertId: alertId ?? null,
        status: 'pending',
        recommendedAction: alertData?.type === 'spread_anomaly' ? 'new_open' : 'watchlist_only',
        legs: alertData?.spreadInfo
          ? [
              {
                asset: alertData.spreadInfo.leg1,
                direction: 'short',
                suggestedSize: 1,
                unit: alertData.spreadInfo.unit,
              },
              {
                asset: alertData.spreadInfo.leg2,
                direction: 'long',
                suggestedSize: 1,
                unit: alertData.spreadInfo.unit,
              },
            ]
          : [],
        priorityScore,
        portfolioFitScore,
        marginEfficiencyScore,
        marginRequired,
        reasoning,
        riskItems: alertData?.riskItems ?? [],
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Record candidate request
    const [candidate] = await db
      .insert(candidateRequests)
      .values({
        alertId: alertId ?? null,
        strategyId: strategyId ?? null,
        requestedAt: now,
        status: 'generated',
        generatedRecommendationId: recommendation.id,
      })
      .returning();

    const response: ApiResponse<{ candidate: CandidateRequest; recommendation: Recommendation }> = {
      success: true,
      data: {
        candidate: serializeRecord<CandidateRequest>(candidate),
        recommendation: serializeRecord<Recommendation>(recommendation),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/candidates/generate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate candidate',
        },
      },
      { status: 500 }
    );
  }
}
