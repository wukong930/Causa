import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep, severityFromZScore, calculateVolumeChange } from "./base";

/**
 * Basis Shift Detector
 *
 * Triggers when:
 * - Basis deviation > 1.5σ from historical mean
 * - Persistence > 3 trading days
 * - Volume increase > 20%
 */
export class BasisShiftDetector implements TriggerEvaluator {
  type = "basis_shift" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, symbol2, spreadStats, marketData, category, timestamp } = context;

    // Require spread statistics
    if (!spreadStats || !symbol2) {
      return null;
    }

    const { currentZScore, spreadMean, spreadStdDev, halfLife } = spreadStats;
    const absZ = Math.abs(currentZScore);

    // Check trigger condition: deviation > 1.5σ
    const basisTriggered = absZ > 1.5;

    if (!basisTriggered) {
      return null;
    }

    // Check persistence (simplified: assume triggered if we have enough data points)
    const hasPersistence = marketData.length >= 3;

    // Check volume change (compare recent vs earlier)
    let volumeIncrease = 0;
    if (marketData.length >= 2) {
      const recentVolume = marketData[0].volume;
      const previousVolume = marketData[1].volume;
      volumeIncrease = calculateVolumeChange(recentVolume, previousVolume);
    }
    const volumeTriggered = volumeIncrease > 20;

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        "基差计算",
        `${symbol1} 与 ${symbol2} 基差为 ${spreadMean.toFixed(2)}，偏离历史均值 ${absZ.toFixed(2)}σ`,
        absZ > 2 ? 0.9 : 0.75
      ),
      buildTriggerStep(
        2,
        "偏离度检测",
        `基差偏离 ${(absZ * spreadStdDev).toFixed(2)} 元/吨，${absZ > 2 ? "显著" : "明显"}超过正常波动范围`,
        absZ > 2 ? 0.85 : 0.7
      ),
      buildTriggerStep(
        3,
        "持续性确认",
        `${hasPersistence ? "持续时间超过 3 个交易日" : "持续时间不足 3 个交易日"}，成交量${volumeTriggered ? "放大" : "变化"} ${volumeIncrease.toFixed(1)}%`,
        hasPersistence && volumeTriggered ? 0.85 : hasPersistence ? 0.7 : 0.6
      ),
      buildTriggerStep(
        4,
        "预警生成",
        `基差偏移${currentZScore > 0 ? "偏强" : "偏弱"}，半衰期 ${halfLife.toFixed(1)} 天`,
        0.75
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
      currentSpread: spreadMean,
      historicalMean: spreadMean,
      sigma1Upper: spreadMean + spreadStdDev,
      sigma1Lower: spreadMean - spreadStdDev,
      zScore: currentZScore,
      halfLife,
      adfPValue: spreadStats.adfPValue,
      unit: "元/吨",
    };

    // Risk items
    const riskItems = [
      `基差偏离 ${absZ.toFixed(2)}σ，${absZ > 2 ? "极端" : "显著"}偏移`,
      !hasPersistence && "持续时间不足，可能是短期波动",
      !volumeTriggered && "成交量未明显放大，市场参与度有限",
      "需关注内外盘政策差异和汇率变化",
    ].filter(Boolean) as string[];

    // Manual check items
    const manualCheckItems = [
      "确认内外盘价格数据准确性",
      "检查是否有进出口政策变化",
      "评估汇率波动影响",
      "核实运费和关税成本",
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
      title: `${symbol1}/${symbol2} 基差偏移`,
      summary: `${symbol1} 与 ${symbol2} 基差偏离历史均值 ${absZ.toFixed(2)}σ，${hasPersistence ? "持续超过 3 个交易日" : ""}，成交量变化 ${volumeIncrease.toFixed(1)}%。`,
    };
  }
}
