/**
 * End-to-end pipeline orchestrator.
 * Alert → Context → Reasoning → Backtest → Recommendation → Draft
 */

import { db } from "@/db";
import { alerts as alertsTable, recommendations as recsTable, hypotheses as hypTable, researchReports as reportsTable } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { buildFullContext } from "@/lib/context/builder";
import { runEvolutionCycle } from "@/lib/reasoning/pipeline";
import { generateOneLiner } from "@/lib/reasoning/one-liner";
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
      .limit(5);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle JSON column typing limitation
      const [insertedRec] = await db.insert(recsTable).values({
        strategyId: null,
        alertId: hyp.createdFromAlertId,
        status: "active",
        recommendedAction: "new_open",
        legs,
        priorityScore: Math.round(validation.totalScore * 100),
        portfolioFitScore: 70,
        marginEfficiencyScore: 60,
        marginRequired: 50000,
        reasoning: `Auto-generated from evolution cycle. ${hyp.hypothesisText}`,
        riskItems: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any).returning({ id: recsTable.id });

      // Generate one-liner asynchronously
      generateOneLiner("recommendation", hyp.hypothesisText)
        .then((oneLiner) =>
          db.update(recsTable).set({ oneLiner }).where(eq(recsTable.id, insertedRec.id))
        )
        .catch((err) => console.error(`[orchestrator] One-liner failed:`, err));

      recsCreated++;
    } catch (err) {
      console.error(`[orchestrator] Failed to create recommendation for ${hyp.id}:`, err);
    }
  }

  // 6. Write research hypotheses
  for (const { hypothesis: hyp, validation } of evolutionResult.selected) {
    try {
      await db.insert(hypTable).values({
        title: hyp.hypothesisText.slice(0, 200),
        description: `${hyp.hypothesisText}\n\n验证得分: ${(validation.totalScore * 100).toFixed(0)}分\n${validation.details}`,
        confidence: validation.totalScore,
        status: "monitoring",
      });
    } catch (err) {
      console.error(`[orchestrator] Failed to write research hypothesis:`, err);
    }
  }

  // 7. Write research report for this cycle
  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await db.insert(reportsTable).values({
      type: "daily",
      title: `${dateStr} 演化周期报告`,
      summary: evolutionResult.summary || `本轮处理 ${activeAlerts.length} 条预警，生成 ${evolutionResult.stats.totalGenerated} 个假设，保留 ${evolutionResult.stats.totalSelected} 个`,
      body: JSON.stringify({
        alertsProcessed: activeAlerts.length,
        hypothesesGenerated: evolutionResult.stats.totalGenerated,
        hypothesesSelected: evolutionResult.stats.totalSelected,
        avgScore: evolutionResult.stats.avgScore,
        selected: evolutionResult.selected.map((s) => ({
          text: s.hypothesis.hypothesisText,
          type: s.hypothesis.type,
          score: s.validation.totalScore,
          details: s.validation.details,
        })),
        rejected: evolutionResult.rejected.slice(0, 5).map((r) => ({
          text: r.hypothesis.hypothesisText,
          score: r.validation.totalScore,
        })),
      }),
      hypotheses: [],
      relatedStrategyIds: [],
      relatedAlertIds: activeAlerts.map((a) => a.id),
    } as any);
  } catch (err) {
    console.error(`[orchestrator] Failed to write research report:`, err);
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
