/**
 * End-to-end pipeline orchestrator.
 * Alert → Context → Reasoning → Backtest → Recommendation → Draft
 */

import { db } from "@/db";
import { alerts as alertsTable, recommendations as recsTable, hypotheses as hypTable, researchReports as reportsTable, positions as posTable } from "@/db/schema";
import { eq, desc, inArray, sql, and, gte } from "drizzle-orm";
import { buildFullContext } from "@/lib/context/builder";
import { runEvolutionCycle } from "@/lib/reasoning/pipeline";
import { generateOneLiner } from "@/lib/reasoning/one-liner";
import { checkHealth as checkBacktestHealth, runBacktest } from "@/lib/backtest/client";
import type { BacktestLeg } from "@/lib/backtest/client";
import { serializeRecords } from "@/lib/serialize";
import type { Alert, PositionGroup } from "@/types/domain";

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
      .orderBy(
        sql`CASE ${alertsTable.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
        desc(alertsTable.triggeredAt)
      )
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

  // 4. Optimize + walk-forward validate spread hypotheses
  let backtestRan = false;
  const backtestHealthy = await checkBacktestHealth();
  interface BtResult {
    sharpe: number; maxDD: number; winRate: number;
    bestParams?: { entry_threshold: number; exit_threshold: number; window: number };
    oosStable?: boolean; sampleSize?: number; avgHoldingDays?: number;
  }
  const backtestResults: Record<string, BtResult> = {};

  if (backtestHealthy) {
    const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";
    for (const { hypothesis: hyp } of evolutionResult.selected) {
      try {
        const assets = hyp.type === "spread"
          ? hyp.legs.map((l) => l.asset)
          : [hyp.leg.asset];

        // ── Directional (single-leg) hypotheses: simple backtest with fixed params ──
        if (assets.length < 2) {
          try {
            const r1 = await fetch(`${BACKTEST_URL}/market-data/${assets[0]}?days=750`, { signal: AbortSignal.timeout(30000) })
              .then((r) => r.ok ? r.json() : []).catch(() => []);
            if (r1.length >= 60) {
              const btLegs: BacktestLeg[] = [{ asset: assets[0], direction: "long", ratio: 1.0 }];
              const prices = { [assets[0]]: r1.map((b: { close: number }) => b.close) };
              const dates = r1.map((b: { date: string }) => b.date);
              // Use a dummy second series (same asset) for the spread engine
              const result = await runBacktest({
                hypothesis_id: hyp.id, legs: btLegs, prices, dates,
                entry_threshold: 2.0, exit_threshold: 0.5, window: 60,
              });
              backtestResults[hyp.id] = {
                sharpe: result.sharpe_ratio, maxDD: result.max_drawdown, winRate: result.win_rate,
                sampleSize: result.trade_count ?? r1.length, avgHoldingDays: result.avg_holding_days,
              };
              backtestRan = true;
            }
          } catch (err) {
            console.error(`[orchestrator] Directional backtest failed for ${hyp.id}:`, err);
          }
          continue;
        }

        // Fetch market data (750 days for optimization)
        const [r1, r2] = await Promise.all(
          assets.slice(0, 2).map((sym) =>
            fetch(`${BACKTEST_URL}/market-data/${sym}?days=750`, { signal: AbortSignal.timeout(30000) })
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
        if (a1.length < 120) continue; // need enough data for optimization

        const btLegs: BacktestLeg[] = hyp.type === "spread"
          ? hyp.legs.map((l) => ({ asset: l.asset, direction: l.direction as "long" | "short", ratio: l.ratio }))
          : [{ asset: assets[0], direction: "long", ratio: 1.0 }, { asset: assets[1] || assets[0], direction: "short", ratio: 1.0 }];

        const prices = { [assets[0]]: a1.map((b: { close: number }) => b.close), [assets[1]]: a2.map((b: { close: number }) => b.close) };
        const dates = a1.map((b: { date: string }) => b.date);

        // Step 4a: Parameter optimization
        let bestParams = { entry_threshold: 2.0, exit_threshold: 0.5, window: 60 };
        try {
          const optRes = await fetch(`${BACKTEST_URL}/optimize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ legs: btLegs, prices, dates }),
            signal: AbortSignal.timeout(30000),
          });
          if (optRes.ok) {
            const opt = await optRes.json();
            if (opt.best_params) bestParams = opt.best_params;
          }
        } catch { /* fall back to defaults */ }

        // Step 4b: Walk-forward validation
        let oosStable = false;
        let wfSharpe = 0;
        try {
          const wfRes = await fetch(`${BACKTEST_URL}/walk-forward`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ legs: btLegs, prices, dates, params: bestParams, n_splits: 5 }),
            signal: AbortSignal.timeout(30000),
          });
          if (wfRes.ok) {
            const wf = await wfRes.json();
            oosStable = wf.stable ?? false;
            wfSharpe = wf.avg_oos_sharpe ?? 0;
          }
        } catch { /* continue without WF */ }

        // Step 4c: Run final backtest with optimized params
        const result = await runBacktest({
          hypothesis_id: hyp.id, legs: btLegs, prices, dates,
          entry_threshold: bestParams.entry_threshold,
          exit_threshold: bestParams.exit_threshold,
          window: bestParams.window,
        });

        backtestResults[hyp.id] = {
          sharpe: result.sharpe_ratio, maxDD: result.max_drawdown, winRate: result.win_rate,
          bestParams, oosStable, sampleSize: result.trade_count ?? a1.length,
          avgHoldingDays: result.avg_holding_days,
        };
        backtestRan = true;
      } catch (err) {
        console.error(`[orchestrator] Backtest failed for ${hyp.id}:`, err);
      }
    }
  }

  // 5. Generate recommendations from selected hypotheses (with backtest quality gate)
  let recsCreated = 0;
  for (const { hypothesis: hyp, validation } of evolutionResult.selected) {
    try {
      const btInfo = backtestResults[hyp.id];

      // ── Backtest quality gate: reject poor-performing hypotheses ──
      if (btInfo) {
        const rejected =
          btInfo.sharpe < 0.3 || btInfo.maxDD < -0.3 || btInfo.winRate < 0.3;
        if (rejected) {
          console.log(
            `[orchestrator] Rejected ${hyp.id}: Sharpe ${btInfo.sharpe.toFixed(2)}, DD ${(btInfo.maxDD * 100).toFixed(1)}%, WR ${(btInfo.winRate * 100).toFixed(0)}%`
          );
          continue;
        }
      }

      // ── Build structured legs with entry/exit/stop ──
      const spreadInfo = hyp.type === "spread" ? hyp : null;
      const BACKTEST_URL_LEG = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";

      // Fetch contract months from term structure endpoint
      const contractMonthCache: Record<string, string> = {};
      const assetsForTermStructure = hyp.type === "spread"
        ? hyp.legs.map((l) => l.asset)
        : [hyp.leg.asset];
      for (const sym of assetsForTermStructure) {
        const baseSymbol = sym.replace(/\d+/, "");
        if (contractMonthCache[baseSymbol]) continue;
        try {
          const tsRes = await fetch(`${BACKTEST_URL_LEG}/term-structure/${baseSymbol}`, { signal: AbortSignal.timeout(5000) });
          if (tsRes.ok) {
            const tsData = await tsRes.json();
            // Pick the contract with highest volume (most liquid near-month)
            if (Array.isArray(tsData) && tsData.length > 0) {
              const sorted = tsData.sort((a: { volume?: number }, b: { volume?: number }) => (b.volume ?? 0) - (a.volume ?? 0));
              const month = sorted[0].contract_month || sorted[0].contractMonth || "";
              if (month) contractMonthCache[baseSymbol] = month;
            }
          }
        } catch { /* use existing contractMonth from hypothesis */ }
      }

      // Compute entryZone, stopLoss, takeProfit from spread statistics
      const rawMean = spreadInfo?.expectedSpread ?? 0;
      const rawStdDev = spreadInfo ? Math.abs(spreadInfo.currentZScore) > 0.01
        ? Math.abs((spreadInfo.currentZScore) / (spreadInfo.currentZScore)) // placeholder
        : 1 : 1;
      // Use btInfo params or hypothesis thresholds
      const entryZ = btInfo?.bestParams?.entry_threshold ?? spreadInfo?.entryThreshold ?? 2.0;
      const exitZ = btInfo?.bestParams?.exit_threshold ?? spreadInfo?.exitThreshold ?? 0.5;

      const legs = hyp.type === "spread"
        ? hyp.legs.map((l) => {
            const baseSymbol = l.asset.replace(/\d+/, "");
            const cm = contractMonthCache[baseSymbol] || l.contractMonth;
            return {
              asset: l.asset,
              contractMonth: cm,
              direction: l.direction,
              suggestedSize: l.ratio * 10,
              unit: "手",
              entryPriceRef: spreadInfo?.currentZScore ?? 0,
              entryZone: spreadInfo ? [
                Math.round(rawMean + entryZ * (spreadInfo.currentZScore > 0 ? 1 : -1) * 0.9),
                Math.round(rawMean + entryZ * (spreadInfo.currentZScore > 0 ? 1 : -1) * 1.1),
              ] as [number, number] : undefined,
              stopLoss: spreadInfo ? Math.round(rawMean + (spreadInfo.stopLossThreshold ?? -3) * (spreadInfo.currentZScore > 0 ? 1 : -1)) : undefined,
              takeProfit: spreadInfo ? Math.round(rawMean) : undefined,
            };
          })
        : [{
            asset: hyp.leg.asset,
            contractMonth: contractMonthCache[hyp.leg.asset.replace(/\d+/, "")] || hyp.leg.contractMonth,
            direction: hyp.leg.direction,
            suggestedSize: hyp.leg.targetSize ?? 10,
            unit: "手",
            entryPriceRef: hyp.entryPrice,
            stopLoss: hyp.stopLoss,
            takeProfit: hyp.takeProfit,
          }];

      const btSummary = btInfo
        ? `\n回测: Sharpe ${btInfo.sharpe.toFixed(2)}, 最大回撤 ${(btInfo.maxDD * 100).toFixed(1)}%, 胜率 ${(btInfo.winRate * 100).toFixed(0)}%`
        : "";

      // Adjust priority score by backtest Sharpe when available
      const baseScore = Math.min(100, Math.max(0, Math.round(validation.totalScore)));
      const priorityScore = btInfo
        ? Math.round(baseScore * (0.5 + 0.5 * Math.min(1, Math.max(0, btInfo.sharpe / 2))))
        : baseScore;

      // Spread hypotheses without backtest results are draft (unverified)
      const status = hyp.type === "spread" && !btInfo ? "draft" : "active";

      // ── Structured fields from backtest + statistics ──
      const maxHoldingDays = btInfo?.avgHoldingDays
        ? Math.ceil(btInfo.avgHoldingDays * 1.5)
        : (spreadInfo?.halfLife ? Math.ceil(spreadInfo.halfLife * 3) : undefined);
      const positionSizePct = btInfo
        ? Math.min(10, Math.max(2, Math.round(5 * Math.min(1, btInfo.sharpe))))
        : undefined;
      const riskRewardRatio = btInfo && btInfo.maxDD !== 0
        ? Math.round(Math.abs(btInfo.sharpe / btInfo.maxDD) * 100) / 100
        : undefined;
      const backtestSummary = btInfo
        ? { sharpe: btInfo.sharpe, winRate: btInfo.winRate, maxDrawdown: btInfo.maxDD, oosStable: btInfo.oosStable ?? false, sampleSize: btInfo.sampleSize ?? 0 }
        : undefined;

      // ── Risk pre-check: downgrade to watchlist_only if portfolio limits exceeded ──
      let recommendedAction: string = "new_open";
      try {
        const openPositions = serializeRecords<PositionGroup>(
          await db.select().from(posTable).where(eq(posTable.status, "open"))
        );
        const totalMarginUsed = openPositions.reduce((s, p) => s + p.totalMarginUsed, 0);
        const estimatedNav = totalMarginUsed > 0 ? totalMarginUsed / 0.5 : 1_000_000; // rough estimate
        const marginUtilization = totalMarginUsed / estimatedNav;

        // Count positions in same category
        const hypCategory = hyp.type === "spread" ? hyp.category : hyp.category;
        const sameCategoryCount = openPositions.filter((p) =>
          p.legs.some((l) => l.asset.replace(/\d+/, "") === (hyp.type === "spread" ? hyp.legs[0]?.asset : hyp.leg.asset)?.replace(/\d+/, ""))
        ).length;

        if (marginUtilization > 0.7 || sameCategoryCount >= 3) {
          recommendedAction = "watchlist_only";
          console.log(`[orchestrator] Downgraded ${hyp.id} to watchlist_only: margin ${(marginUtilization * 100).toFixed(0)}%, same-category ${sameCategoryCount}`);
        }
      } catch { /* proceed with new_open */ }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle JSON column typing limitation
      const [insertedRec] = await db.insert(recsTable).values({
        strategyId: null,
        alertId: hyp.createdFromAlertId,
        status,
        recommendedAction,
        legs,
        priorityScore,
        portfolioFitScore: 70,
        marginEfficiencyScore: 60,
        marginRequired: 50000,
        reasoning: `Auto-generated from evolution cycle. ${hyp.hypothesisText}${btSummary}`,
        riskItems: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxHoldingDays: maxHoldingDays ?? null,
        positionSizePct: positionSizePct ?? null,
        riskRewardRatio: riskRewardRatio ?? null,
        backtestSummary: backtestSummary ?? null,
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
