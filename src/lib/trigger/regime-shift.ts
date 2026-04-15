import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep } from "./base";

/**
 * Regime Shift Detector
 *
 * Detects structural market regime changes:
 * - Volatility regime: sudden shift in price volatility
 * - Correlation regime: if symbol2 provided, correlation breakdown
 * - Trend regime: using a simplified Hurst exponent proxy (V-statistic)
 *
 * A regime shift suggests structural changes in market behavior
 * that may invalidate mean-reversion strategies.
 */
export class RegimeShiftDetector implements TriggerEvaluator {
  type = "regime_shift" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, symbol2, marketData, spreadStats } = context;

    if (marketData.length < 30) {
      return null;
    }

    // Sort by timestamp ascending
    const sorted = [...marketData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const closes = sorted.map((d) => d.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    // Split into periods for regime detection
    const windowSize = Math.min(15, Math.floor(returns.length / 2));
    const recentReturns = returns.slice(-windowSize);
    const midReturns = returns.slice(-windowSize * 2, -windowSize);
    const historicalReturns = returns.slice(0, windowSize);

    if (recentReturns.length < 5 || midReturns.length < 5 || historicalReturns.length < 5) {
      return null;
    }

    // Calculate volatility for each period
    const recentVol = this.stdDev(recentReturns);
    const midVol = this.stdDev(midReturns);
    const historicalVol = this.stdDev(historicalReturns);

    // Volatility regime change detection
    const volShiftFromMid = recentVol / midVol;
    const volShiftFromHistorical = recentVol / historicalVol;

    // Regime classification
    const volRegimeChanged = volShiftFromMid > 1.5 || volShiftFromMid < 0.67;

    // Correlation regime change (if spread data available)
    let correlationShift = 0;
    let correlationUnstable = false;
    if (spreadStats && symbol2) {
      // Compare current Z-score behavior to historical
      // If spread is oscillating more aggressively, correlation regime may have shifted
      correlationUnstable = Math.abs(spreadStats.currentZScore) > 1.5;
    }

    // Simplified Hurst/V-statistic: measure of trend vs mean-reversion
    // High V-statistic (>0.5) = trending, Low (<0.5) = mean-reverting
    const vStat = this.calculateVStatistic(returns);
    const recentVStat = this.calculateVStatistic(recentReturns);
    const regimeShift = Math.abs(recentVStat - vStat) > 0.2;

    // Overall regime shift detection
    const regimeShiftTriggered =
      volRegimeChanged || regimeShift || correlationUnstable;

    if (!regimeShiftTriggered) {
      return null;
    }

    // Determine direction of regime change
    const volIncreasing = recentVol > historicalVol;
    const trendStrengthening = recentVStat > vStat;

    // Build trigger chain
    const triggerChain = [
      buildTriggerStep(
        1,
        "波动率 Regime 检测",
        `${symbol1} 近${windowSize}日波动率 ${(recentVol * 100).toFixed(3)}%，前期 ${(midVol * 100).toFixed(3)}%，历史 ${(historicalVol * 100).toFixed(3)}%`,
        volRegimeChanged ? 0.85 : 0.5
      ),
      buildTriggerStep(
        2,
        "趋势强度分析",
        `V-statistic 当前 ${recentVStat.toFixed(3)}，历史 ${vStat.toFixed(3)}，${trendStrengthening ? "趋势增强" : "均值回归增强"}`,
        regimeShift ? 0.8 : 0.5
      ),
      buildTriggerStep(
        3,
        "相关性检查",
        correlationUnstable && symbol2
          ? `${symbol1}/${symbol2} 价差 Z-score ${spreadStats!.currentZScore.toFixed(2)}，相关性不稳定`
          : "相关性未显著变化",
        correlationUnstable ? 0.75 : 0.5
      ),
      buildTriggerStep(
        4,
        "Regime 确认",
        volIncreasing ? "波动率上升，市场进入高波动 Regime" : "波动率下降，市场进入低波动 Regime",
        volRegimeChanged ? 0.85 : 0.6
      ),
    ];

    const confidence =
      triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    const severity =
      (volRegimeChanged && Math.abs(volShiftFromMid - 1) > 2) || regimeShift
        ? "high"
        : volRegimeChanged || correlationUnstable
        ? "medium"
        : "low";

    const regimeType = volIncreasing ? "高波动" : "低波动";

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      relatedAssets: symbol2 ? [symbol1, symbol2] : [symbol1],
      riskItems: [
        `${volIncreasing ? "波动率上升" : "波动率下降"} ${volShiftFromHistorical.toFixed(2)}x，Regime 改变`,
        regimeShift ? `市场趋势特征改变（V-statistic 变化 ${Math.abs(recentVStat - vStat).toFixed(2)}）` : null,
        correlationUnstable && symbol2 ? `${symbol1}/${symbol2} 相关性可能发生结构性变化` : null,
        "均值回归策略假设可能不再成立",
      ].filter(Boolean) as string[],
      manualCheckItems: [
        "评估现有策略在当前 Regime 下的适用性",
        "检查是否有宏观经济或政策环境变化",
        "考虑调整仓位或策略参数",
      ],
      title: `${symbol1} 市场 Regime 转换`,
      summary: `${symbol1} 检测到市场 Regime 变化：${regimeType} Regime${volRegimeChanged ? `（波动率变化 ${volShiftFromMid.toFixed(2)}x）` : ""}${regimeShift ? `，趋势特征改变` : ""}。现有策略可能需要重新评估。`,
    };
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Simplified V-statistic for trend/mean-reversion detection
   * Based on the ratio of price range to volatility
   * V > 0.5 suggests trending behavior, V < 0.5 suggests mean-reversion
   */
  private calculateVStatistic(returns: number[]): number {
    if (returns.length < 3) return 0.5;

    const cumulative: number[] = [0];
    for (let i = 0; i < returns.length; i++) {
      cumulative.push(cumulative[i] + returns[i]);
    }

    const max = Math.max(...cumulative);
    const min = Math.min(...cumulative);
    const range = max - min;
    const vol = this.stdDev(returns) * Math.sqrt(returns.length);

    if (vol === 0) return 0.5;
    return Math.min(1, Math.max(0, range / (2 * vol)));
  }
}
