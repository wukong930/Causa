import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep, severityFromZScore } from "./base";
import { getAdaptiveThresholds } from "./adaptive-threshold";

/**
 * Spread Anomaly Detector
 *
 * Triggers when:
 * - Z-score > 2.0 or < -2.0
 * - ADF p-value < 0.05 (stationarity test)
 * - Half-life < 30 days (fast mean reversion)
 */
export class SpreadAnomalyDetector implements TriggerEvaluator {
  type = "spread_anomaly" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, symbol2, spreadStats, category, timestamp } = context;

    // Require spread statistics
    if (!spreadStats || !symbol2) {
      return null;
    }

    const { adfPValue, halfLife, spreadMean, spreadStdDev, currentZScore, rawSpreadMean, rawSpreadStdDev } = spreadStats;
    const absZ = Math.abs(currentZScore);
    // Use raw spread values for display (historicalMean, sigma bands, currentSpread)
    const displayMean = rawSpreadMean ?? spreadMean;
    const displayStdDev = rawSpreadStdDev ?? spreadStdDev;

    // Adaptive thresholds based on category, regime, and half-life
    const thresholds = getAdaptiveThresholds(category, undefined, halfLife);

    // Check trigger conditions
    const zScoreTriggered = absZ > thresholds.zScoreEntry;
    const adfTriggered = adfPValue < 0.05;
    const halfLifeTriggered = halfLife < thresholds.halfLifeCap;

    if (!zScoreTriggered) {
      return null;
    }

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        "数据异常检测",
        `${symbol1} 与 ${symbol2} 价差 Z-score 为 ${currentZScore.toFixed(2)}，${absZ > 2 ? "显著" : ""}偏离历史均值`,
        absZ > 3 ? 0.95 : absZ > 2.5 ? 0.85 : 0.75
      ),
      buildTriggerStep(
        2,
        "价差扩张确认",
        `当前价差 ${(displayMean + currentZScore * displayStdDev).toFixed(2)}，历史均值 ${displayMean.toFixed(2)}，标准差 ${displayStdDev.toFixed(2)}`,
        0.8
      ),
      buildTriggerStep(
        3,
        "统计阈值触发",
        `Z-score ${currentZScore > 0 ? "上穿" : "下穿"} ${absZ > 3 ? "3σ" : absZ > 2.5 ? "2.5σ" : "2σ"} 阈值`,
        absZ > 3 ? 0.9 : absZ > 2.5 ? 0.8 : 0.7
      ),
      buildTriggerStep(
        4,
        "预警生成",
        `${adfTriggered ? "平稳性检验通过" : "平稳性检验未通过"}，半衰期 ${halfLife.toFixed(1)} 天${halfLifeTriggered ? "（快速回归）" : ""}`,
        adfTriggered && halfLifeTriggered ? 0.9 : adfTriggered ? 0.75 : 0.6
      ),
    ];

    // Calculate overall confidence
    const confidence = triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    // Determine severity
    const severity = severityFromZScore(currentZScore);

    // Build spread info
    const spreadInfo = {
      leg1: symbol1,
      leg2: symbol2,
      currentSpread: displayMean + currentZScore * displayStdDev,
      historicalMean: displayMean,
      sigma1Upper: displayMean + displayStdDev,
      sigma1Lower: displayMean - displayStdDev,
      zScore: currentZScore,
      halfLife,
      adfPValue,
      unit: "元/吨",
    };

    // Risk items
    const riskItems = [
      `价差 Z-score ${currentZScore.toFixed(2)}，${absZ > 3 ? "极端" : "显著"}偏离`,
      !adfTriggered && "平稳性检验未通过，均值回归假设可能不成立",
      !halfLifeTriggered && `半衰期 ${halfLife.toFixed(1)} 天，回归速度较慢`,
      "需关注基本面变化和政策风险",
    ].filter(Boolean) as string[];

    // Manual check items
    const manualCheckItems = [
      "确认两个合约的流动性充足",
      "检查是否有重大事件或政策变化",
      "核实价差计算的准确性",
      "评估交易成本和滑点影响",
    ];

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      spreadInfo,
      relatedAssets: [symbol1, symbol2],
      riskItems,
      manualCheckItems,
      title: `${symbol1}/${symbol2} 价差异常`,
      summary: `${symbol1} 与 ${symbol2} 价差 Z-score 达到 ${currentZScore.toFixed(2)}，${currentZScore > 0 ? "显著高于" : "显著低于"}历史均值，${adfTriggered ? "平稳性检验通过" : ""}，半衰期 ${halfLife.toFixed(1)} 天。`,
    };
  }
}
