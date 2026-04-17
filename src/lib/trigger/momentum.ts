import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep, calculateMA, calculateVolumeChange } from "./base";
import { getAdaptiveThresholds } from "./adaptive-threshold";

/**
 * Momentum Detector
 *
 * Triggers when:
 * - 5-day MA crosses 20-day MA
 * - Volume increase > 30%
 * - Price breaks recent high/low
 */
export class MomentumDetector implements TriggerEvaluator {
  type = "momentum" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, marketData, category, timestamp } = context;

    // Need at least 20 data points for MA calculation
    if (marketData.length < 20) {
      return null;
    }

    // Extract close prices (most recent first, need to reverse for MA calculation)
    const closePrices = marketData.map((d) => d.close).reverse();
    const volumes = marketData.map((d) => d.volume).reverse();

    // Calculate moving averages
    const ma5 = calculateMA(closePrices, 5);
    const ma20 = calculateMA(closePrices, 20);

    // Check for crossover (current and previous)
    const currentIdx = ma5.length - 1;
    const prevIdx = currentIdx - 1;

    if (isNaN(ma5[currentIdx]) || isNaN(ma20[currentIdx]) || isNaN(ma5[prevIdx]) || isNaN(ma20[prevIdx])) {
      return null;
    }

    const currentMA5 = ma5[currentIdx];
    const currentMA20 = ma20[currentIdx];
    const prevMA5 = ma5[prevIdx];
    const prevMA20 = ma20[prevIdx];

    // Detect crossover
    const bullishCross = prevMA5 <= prevMA20 && currentMA5 > currentMA20;
    const bearishCross = prevMA5 >= prevMA20 && currentMA5 < currentMA20;

    if (!bullishCross && !bearishCross) {
      return null;
    }

    const direction = bullishCross ? "上穿" : "下穿";
    const trend = bullishCross ? "看涨" : "看跌";

    // Check volume increase
    const recentVolume = volumes[currentIdx];
    const previousVolume = volumes[prevIdx];
    const volumeChange = calculateVolumeChange(recentVolume, previousVolume);
    const thresholds = getAdaptiveThresholds(category);
    const volumeTriggered = volumeChange > thresholds.volumeSpike;

    // Check price breakout (compare current price with recent 10-day high/low)
    const recentPrices = closePrices.slice(currentIdx - 10, currentIdx);
    const recentHigh = Math.max(...recentPrices);
    const recentLow = Math.min(...recentPrices);
    const currentPrice = closePrices[currentIdx];
    const priceBreakout = bullishCross ? currentPrice > recentHigh : currentPrice < recentLow;

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        "均线计算",
        `5日均线 ${currentMA5.toFixed(2)}，20日均线 ${currentMA20.toFixed(2)}`,
        0.8
      ),
      buildTriggerStep(
        2,
        "交叉信号检测",
        `5日均线${direction}20日均线，形成${trend}信号`,
        0.85
      ),
      buildTriggerStep(
        3,
        "成交量确认",
        `成交量${volumeTriggered ? "放大" : "变化"} ${volumeChange.toFixed(1)}%${volumeTriggered ? "，确认趋势" : ""}`,
        volumeTriggered ? 0.85 : 0.65
      ),
      buildTriggerStep(
        4,
        "预警生成",
        `价格 ${currentPrice.toFixed(2)}${priceBreakout ? `，突破近期${bullishCross ? "高点" : "低点"}` : ""}`,
        priceBreakout ? 0.9 : 0.7
      ),
    ];

    // Calculate overall confidence
    const confidence = triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    // Determine severity based on volume and breakout
    let severity: "critical" | "high" | "medium" | "low" = "medium";
    if (volumeTriggered && priceBreakout) {
      severity = "high";
    } else if (volumeTriggered || priceBreakout) {
      severity = "medium";
    } else {
      severity = "low";
    }

    // Risk items
    const riskItems = [
      `均线交叉信号，${trend}趋势`,
      !volumeTriggered && "成交量未明显放大，信号强度有限",
      !priceBreakout && "价格未突破关键位，需观察确认",
      "技术信号需结合基本面验证",
    ].filter(Boolean) as string[];

    // Manual check items
    const manualCheckItems = [
      "确认是否有基本面支撑",
      "检查是否有重大事件催化",
      "评估趋势持续性",
      "核实成交量真实性",
    ];

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      relatedAssets: [symbol1],
      riskItems,
      manualCheckItems,
      title: `${symbol1} 动量信号`,
      summary: `${symbol1} 5日均线${direction}20日均线，形成${trend}信号，成交量变化 ${volumeChange.toFixed(1)}%${priceBreakout ? `，价格突破近期${bullishCross ? "高点" : "低点"}` : ""}。`,
    };
  }
}
