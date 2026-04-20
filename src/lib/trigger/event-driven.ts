import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep, calculateMA } from "./base";

/**
 * Event-Driven Detector
 *
 * Triggers when:
 * - Price gap > 3% from previous close (gap up/down)
 * - Volume spike > 30% above 10-day average
 * - Both conditions combined indicate external event impact
 */
export class EventDrivenDetector implements TriggerEvaluator {
  type = "event_driven" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, marketData } = context;

    if (marketData.length < 5) {
      return null;
    }

    // Sort by timestamp ascending (oldest first)
    const sorted = [...marketData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const closes = sorted.map((d) => d.close);
    const volumes = sorted.map((d) => d.volume);
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    if (!latest || !previous) {
      return null;
    }

    // Calculate price gap percentage
    const gapPercent = Math.abs((latest.close - previous.close) / previous.close) * 100;

    // Dynamic gap threshold based on recent volatility
    const recentSlice = sorted.slice(-Math.min(20, sorted.length));
    const avgDailyRange = recentSlice.reduce((sum, d) => sum + (d.high - d.low) / d.close, 0) / recentSlice.length * 100;
    const gapThreshold = Math.max(3.0, avgDailyRange * 2.5);

    // Calculate 10-day average volume
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeSpikePercent = avgVolume > 0 ? ((latest.volume - avgVolume) / avgVolume) * 100 : 0;

    // Trigger conditions
    const gapTriggered = gapPercent > gapThreshold;
    const volumeTriggered = volumeSpikePercent > 30.0;
    const combinedTriggered = gapTriggered && volumeTriggered;

    if (!combinedTriggered && !gapTriggered && !volumeTriggered) {
      return null;
    }

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        "价格跳空检测",
        `${symbol1} 收盘价从 ${previous.close} 跳至 ${latest.close}，跳空 ${gapPercent.toFixed(2)}%`,
        gapTriggered ? 0.9 : 0.3
      ),
      buildTriggerStep(
        2,
        "成交量异常确认",
        `最新成交量 ${latest.volume.toFixed(0)}，10日均值 ${avgVolume.toFixed(0)}，偏离 ${volumeSpikePercent.toFixed(1)}%`,
        volumeTriggered ? 0.85 : 0.4
      ),
      buildTriggerStep(
        3,
        "事件信号评估",
        `${gapTriggered ? "价格跳空" : ""}${gapTriggered && volumeTriggered ? " + " : ""}${volumeTriggered ? "成交量放大" : ""}，疑似外部事件驱动`,
        combinedTriggered ? 0.9 : gapTriggered ? 0.7 : 0.5
      ),
      buildTriggerStep(
        4,
        "预警生成",
        `${combinedTriggered ? "双重信号确认" : gapTriggered ? "价格跳空触发" : "成交量放大触发"}，建议人工确认事件原因`,
        combinedTriggered ? 0.85 : 0.65
      ),
    ];

    const confidence =
      triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    const severity =
      combinedTriggered || gapPercent > 5 ? "high" : gapTriggered ? "medium" : "low";

    const direction = latest.close > previous.close ? "上涨" : "下跌";

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      relatedAssets: [symbol1],
      riskItems: [
        `价格跳空 ${gapPercent.toFixed(2)}%，${direction}`,
        volumeTriggered ? `成交量放大 ${volumeSpikePercent.toFixed(1)}%` : null,
        "可能存在外部事件驱动，需确认原因",
      ].filter(Boolean) as string[],
      manualCheckItems: [
        "查询是否有相关新闻或政策公告",
        "确认流动性是否充足",
        "评估事件持续性影响",
      ],
      title: `${symbol1} 事件驱动信号`,
      summary: `${symbol1} 出现价格跳空 ${gapPercent.toFixed(2)}%${volumeTriggered ? `，成交量放大 ${volumeSpikePercent.toFixed(1)}%` : ""}，疑似外部事件驱动。`,
    };
  }
}
