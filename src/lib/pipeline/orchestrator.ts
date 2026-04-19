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
import { checkHealth as checkBacktestHealth, runBacktest } from "@/lib/backtest/client";
import type { BacktestLeg } from "@/lib/backtest/client";
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

  // 4. Attempt backtest for spread hypotheses (graceful degradation)
  let backtestRan = false;
  const backtestHealthy = await checkBacktestHealth();
  const backtestResults: Record<string, { sharpe: number; maxDD: number; winRate: number }> = {};

  if (backtestHealthy) {
    const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";
    for (const { hypothesis: hyp } of evolutionResult.selected) {
      try {
        const assets = hyp.type === "spread"
          ? hyp.legs.map((l) => l.asset)
          : [hyp.leg.asset];

        if (assets.length < 2) continue;

        // Fetch market data from AkShare
        const [r1, r2] = await Promise.all(
          assets.slice(0, 2).map((sym) =>
            fetch(`${BACKTEST_URL}/market-data/${sym}?days=250`, { signal: AbortSignal.timeout(15000) })
              .then((r) => r.ok ? r.json() : [])
              .catch(() => [])
          )
        );
        if (!r1.length || !r2.length) continue;

        // Align dates
        const dateSet2 = new Set(r2.map((b: { date: string }) => b.date));
        const a1 = r1.filter((b: { date: string }) => dateSet2.has(b.date));
        const dateSet1 = new Set(a1.map((b: { date: string }) => b.date));
        const a2 = r2.filter((b: { date: string }) => dateSet1.has(b.date));

        const btLegs: BacktestLeg[] = hyp.type === "spread"
          ? hyp.legs.map((l) => ({ asset: l.asset, direction: l.direction as "long" | "short", ratio: l.ratio }))
          : [{ asset: assets[0], direction: "long", ratio: 1.0 }, { asset: assets[1] || assets[0], direction: "short", ratio: 1.0 }];

        const result = await runBacktest({
          hypothesis_id: hyp.id,
          legs: btLegs,
          prices: { [assets[0]]: a1.map((b: { close: number }) => b.close), [assets[1]]: a2.map((b: { close: number }) => b.close) },
          dates: a1.map((b: { date: string }) => b.date),
          entry_threshold: 2.0,
          exit_threshold: 0.5,
          window: 60,
        });

        backtestResults[hyp.id] = { sharpe: result.sharpe_ratio, maxDD: result.max_drawdown, winRate: result.win_rate };
        backtestRan = true;
      } catch (err) {
        console.error(`[orchestrator] Backtest failed for ${hyp.id}:`, err);
      }
    }
  }

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

      const btInfo = backtestResults[hyp.id];
      const btSummary = btInfo
        ? `\n回测: Sharpe ${btInfo.sharpe.toFixed(2)}, 最大回撤 ${(btInfo.maxDD * 100).toFixed(1)}%, 胜率 ${(btInfo.winRate * 100).toFixed(0)}%`
        : "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle JSON column typing limitation
      const [insertedRec] = await db.insert(recsTable).values({
        strategyId: null,
        alertId: hyp.createdFromAlertId,
        status: "active",
        recommendedAction: "new_open",
        legs,
        priorityScore: Math.min(100, Math.max(0, Math.round(validation.totalScore))),
        portfolioFitScore: 70,
        marginEfficiencyScore: 60,
        marginRequired: 50000,
        reasoning: `Auto-generated from evolution cycle. ${hyp.hypothesisText}${btSummary}`,
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
        description: `${hyp.hypothesisText}\n\n验证得分: ${Math.round(validation.totalScore)}分\n${validation.details}`,
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
