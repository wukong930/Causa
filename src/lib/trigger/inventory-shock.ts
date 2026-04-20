import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep } from "./base";

/**
 * Inventory Shock Detector
 *
 * Detects inventory-related shocks using price and volume proxies:
 * - Daily range ratio spike (high-low)/close - wider ranges suggest inventory pressure
 * - Rolling volatility change - sudden volatility increase indicates supply/demand imbalance
 * - Basis instability if spread data available
 *
 * In production, this would integrate with actual inventory data (weekly EIA reports).
 */
export class InventoryShockDetector implements TriggerEvaluator {
  type = "inventory_shock" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, marketData, spreadStats, industryData } = context;

    if (marketData.length < 10) {
      return null;
    }

    // Sort by timestamp ascending
    const sorted = [...marketData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // ── Real inventory data path ──
    let inventoryShockDetected = false;
    let inventoryChangeRatio = 0;
    let inventoryDescription = "";

    if (industryData?.inventory && industryData.inventory.length >= 5) {
      const inv = industryData.inventory;
      const recent = inv.slice(-3);
      const earlier = inv.slice(-8, -3);
      if (earlier.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
        const earlierAvg = earlier.reduce((a, b) => a + b.value, 0) / earlier.length;
        inventoryChangeRatio = earlierAvg > 0 ? (recentAvg - earlierAvg) / earlierAvg : 0;
        inventoryShockDetected = Math.abs(inventoryChangeRatio) > 0.15; // 15% change
        inventoryDescription = `库存从 ${earlierAvg.toFixed(0)} → ${recentAvg.toFixed(0)}，变化 ${(inventoryChangeRatio * 100).toFixed(1)}%`;
      }
    }

    // ── Price/volume proxy path (fallback) ──
    // Calculate daily range ratios as proxy for inventory pressure
    const rangeRatios = sorted.map((d) => (d.high - d.low) / d.close);

    // Split into recent (last 5) and historical (previous 10)
    const recentRange = rangeRatios.slice(-5);
    const historicalRange = rangeRatios.slice(-15, -5);

    if (historicalRange.length === 0) {
      return null;
    }

    const recentAvgRange = recentRange.reduce((a, b) => a + b, 0) / recentRange.length;
    const historicalAvgRange = historicalRange.reduce((a, b) => a + b, 0) / historicalRange.length;
    const rangeRatio = recentAvgRange / historicalAvgRange;

    // Calculate rolling volatility (std dev of returns)
    const closes = sorted.map((d) => d.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    const recentReturns = returns.slice(-5);
    const historicalReturns = returns.slice(-15, -5);

    if (historicalReturns.length === 0) {
      return null;
    }

    const recentVol = this.stdDev(recentReturns);
    const historicalVol = this.stdDev(historicalReturns);
    const volRatio = recentVol / historicalVol;

    // Check spread instability if available
    const spreadUnstable =
      spreadStats && Math.abs(spreadStats.currentZScore) > 1.5;

    // Trigger conditions
    const rangeTriggered = rangeRatio > 1.8;
    const volTriggered = volRatio > 1.6;
    const inventoryTriggered = inventoryShockDetected || (rangeTriggered && volTriggered);

    if (!inventoryTriggered && !rangeTriggered && !volTriggered) {
      return null;
    }

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        inventoryShockDetected ? "库存数据检测" : "日内波幅检测",
        inventoryShockDetected
          ? `${symbol1} ${inventoryDescription}`
          : `${symbol1} 近5日均波幅率 ${(recentAvgRange * 100).toFixed(2)}%，历史均值 ${(historicalAvgRange * 100).toFixed(2)}%，比率 ${rangeRatio.toFixed(2)}x`,
        inventoryShockDetected ? 0.9 : rangeTriggered ? 0.85 : 0.4
      ),
      buildTriggerStep(
        2,
        "波动率变化分析",
        `近期波动率 ${(recentVol * 100).toFixed(3)}%，历史波动率 ${(historicalVol * 100).toFixed(3)}%，比率 ${volRatio.toFixed(2)}x`,
        volTriggered ? 0.8 : 0.35
      ),
      buildTriggerStep(
        3,
        "价差稳定性检查",
        spreadUnstable ? `价差 Z-score ${spreadStats!.currentZScore.toFixed(2)}，基差不稳定` : "价差未显著偏离",
        spreadUnstable ? 0.75 : 0.5
      ),
      buildTriggerStep(
        4,
        "库存冲击评估",
        inventoryTriggered
          ? "波动率和波幅双指标触发，疑似库存冲击"
          : rangeTriggered
          ? "波幅指标触发，建议关注"
          : "波动率指标触发，建议关注",
        inventoryTriggered ? 0.9 : rangeTriggered || volTriggered ? 0.65 : 0.5
      ),
    ];

    const confidence =
      triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    const severity = inventoryTriggered ? "high" : rangeTriggered ? "medium" : "low";

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      relatedAssets: [symbol1],
      riskItems: [
        rangeTriggered
          ? `日内波幅扩大 ${rangeRatio.toFixed(2)}x，疑似库存压力变化`
          : null,
        volTriggered
          ? `波动率上升 ${volRatio.toFixed(2)}x，供需平衡可能打破`
          : null,
        spreadUnstable ? "价差基差不稳定" : null,
        "建议核对最新库存数据",
      ].filter(Boolean) as string[],
      manualCheckItems: [
        "查询最新库存数据（EIA/港口库存）",
        "检查上下游开工率变化",
        "评估库存周期所处阶段",
      ],
      title: `${symbol1} 库存冲击信号`,
      summary: `${symbol1} 检测到波动率变化（${volRatio.toFixed(2)}x）和日内波幅变化（${rangeRatio.toFixed(2)}x）${inventoryTriggered ? "，双重信号确认库存冲击" : ""}。建议核对库存数据。`,
    };
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
