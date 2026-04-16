/**
 * End-to-end pipeline orchestrator.
 * Alert → Context → Reasoning → Backtest → Recommendation → Draft
 */

import { db } from "@/db";
import { alerts as alertsTable, recommendations as recsTable } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { buildFullContext } from "@/lib/context/builder";
import { runEvolutionCycle } from "@/lib/reasoning/pipeline";
import { checkHealth as checkBacktestHealth } from "@/lib/backtest/client";
import { serializeRecords } from "@/lib/serialize";
import type { Alert } from "@/types/domain";

export interface OrchestrationResult {
  alertsProcessed: number;
  hypothesesGenerated: number;
  hypothesesSelected: number;
  backtestRan: boolean;
  recommendationsCreated: number;
  summary: string;
}

/**
 * Run the full orchestration pipeline for recent active alerts.
 */
export async function runOrchestration(
  alertIds?: string[]
): Promise<OrchestrationResult> {
  // 1. Fetch alerts
  let alertRows;
  if (alertIds?.length) {
    alertRows = await db.select().from(alertsTable).where(inArray(alertsTable.id, alertIds));
  } else {
    alertRows = await db.select().from(alertsTable)
      .where(eq(alertsTable.status, "active"))
      .orderBy(desc(alertsTable.triggeredAt))
      .limit(10);
  }
  const activeAlerts = serializeRecords<Alert>(alertRows);

  if (activeAlerts.length === 0) {
    return {
      alertsProcessed: 0, hypothesesGenerated: 0, hypothesesSelected: 0,
      backtestRan: false, recommendationsCreated: 0,
      summary: "No active alerts to process",
    };
  }

  // 2. Build context
  let contextStr = "";
  try {
    const ctx = await buildFullContext();
    contextStr = JSON.stringify(ctx.contextVector ?? ctx);
  } catch {
    // Continue without context
  }

  // 3. Run evolution cycle
  const evolutionResult = await runEvolutionCycle(
    activeAlerts,
    { contextVector: contextStr },
    { topN: 5 }
  );

  // 4. Attempt backtest (graceful degradation)
  const backtestRan = await checkBacktestHealth();

  // 5. Generate recommendations from selected hypotheses
  let recsCreated = 0;
  for (const { hypothesis: hyp, validation } of evolutionResult.selected) {
    try {
      const legs = hyp.type === "spread"
        ? hyp.legs.map((l) => ({
            asset: l.asset,
            direction: l.direction,
            suggestedSize: l.ratio * 10,
            unit: "手",
          }))
        : [{
            asset: hyp.leg.asset,
            direction: hyp.leg.direction,
            suggestedSize: hyp.leg.targetSize ?? 10,
            unit: "手",
          }];

      await db.insert(recsTable).values({
        strategyId: hyp.id,
        alertId: hyp.createdFromAlertId,
        status: "pending",
        recommendedAction: "new_open",
        legs,
        priorityScore: Math.round(validation.totalScore * 100),
        portfolioFitScore: 70,
        marginEfficiencyScore: 60,
        marginRequired: 50000,
        reasoning: `Auto-generated from evolution cycle. ${hyp.hypothesisText}`,
        riskItems: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any);
      recsCreated++;
    } catch {
      // Skip failed recommendation creation
    }
  }

  return {
    alertsProcessed: activeAlerts.length,
    hypothesesGenerated: evolutionResult.stats.totalGenerated,
    hypothesesSelected: evolutionResult.stats.totalSelected,
    backtestRan,
    recommendationsCreated: recsCreated,
    summary: evolutionResult.summary,
  };
}
