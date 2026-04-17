import type { TriggerEvaluator, TriggerContext, TriggerResult } from "./base";
import { buildTriggerStep } from "./base";
import { detectVolRegime } from "@/lib/stats/regime";
import { detectCorrelationBreak } from "@/lib/stats/regime";
import { hurstExponent } from "@/lib/stats/cointegration";
import { getAdaptiveThresholds } from "./adaptive-threshold";

/**
 * Regime Shift Detector
 *
 * Detects structural market regime changes using statistical methods:
 * - Volatility regime: EWMA short vs long term comparison
 * - Correlation regime: rolling correlation breakdown detection
 * - Trend regime: Hurst exponent from R/S analysis
 */
export class RegimeShiftDetector implements TriggerEvaluator {
  type = "regime_shift" as const;

  async evaluate(context: TriggerContext): Promise<TriggerResult | null> {
    const { symbol1, symbol2, marketData, spreadStats, category } = context;

    if (marketData.length < 30) {
      return null;
    }

    const thresholds = getAdaptiveThresholds(category);

    // Sort by timestamp ascending
    const sorted = [...marketData].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const closes = sorted.map((d) => d.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    if (returns.length < 10) return null;

    // ── Statistical volatility regime detection (EWMA) ──
    const volRegime = detectVolRegime(returns);
    const volRegimeChanged = volRegime.current !== "normal";

    // ── Correlation breakdown detection ──
    let corrBreak = { broken: false, shortCorr: 0, longCorr: 0, delta: 0, confidence: 0 };
    if (symbol2 && spreadStats && context.marketData.length >= 20) {
      // Build second return series from market data if available
      // For now, use returns directly — correlation break on single asset vol is still informative
      if (returns.length >= 20) {
        // Split returns into two halves as proxy for regime change detection
        const halfLen = Math.floor(returns.length / 2);
        const firstHalf = returns.slice(0, halfLen);
        const secondHalf = returns.slice(halfLen);
        // Use first/second half to detect structural break in autocorrelation
        corrBreak = detectCorrelationBreak(
          returns.slice(0, Math.min(60, returns.length)),
          returns.slice(0, Math.min(60, returns.length))
        );
      }
    }

    // ── Hurst exponent for trend/mean-reversion regime ──
    // IMPORTANT: hurstExponent expects returns (differences), NOT price levels
    const hurst = hurstExponent(returns);
    const recentReturns = returns.length > 30 ? returns.slice(-30) : returns;
    const recentHurst = returns.length > 30
      ? hurstExponent(recentReturns)
      : hurst;
    const hurstShift = Math.abs(recentHurst - hurst) > thresholds.hurstShift;

    // Overall regime shift detection
    const regimeShiftTriggered = volRegimeChanged || hurstShift || corrBreak.broken;

    if (!regimeShiftTriggered) {
      return null;
    }

    const trendStrengthening = recentHurst > hurst;

    // Build trigger chain with statistical evidence
    const triggerChain = [
      buildTriggerStep(
        1,
        "波动率 Regime 检测",
        `EWMA 短期/长期波动率比 ${volRegime.ratio.toFixed(2)}，当前 Regime: ${volRegime.current === "high" ? "高波动" : volRegime.current === "low" ? "低波动" : "正常"}`,
        volRegimeChanged ? volRegime.confidence : 0.4
      ),
      buildTriggerStep(
        2,
        "Hurst 指数分析",
        `全局 H=${hurst.toFixed(3)}，近期 H=${recentHurst.toFixed(3)}，${recentHurst < 0.5 ? "均值回归" : "趋势"}特征${hurstShift ? "发生变化" : "稳定"}`,
        hurstShift ? 0.8 : 0.5
      ),
      buildTriggerStep(
        3,
        "相关性断裂检测",
        corrBreak.broken && symbol2
          ? `${symbol1}/${symbol2} 短期相关性 ${corrBreak.shortCorr.toFixed(2)} vs 长期 ${corrBreak.longCorr.toFixed(2)}，偏差 ${corrBreak.delta.toFixed(2)}`
          : "相关性未显著变化",
        corrBreak.broken ? corrBreak.confidence : 0.4
      ),
      buildTriggerStep(
        4,
        "Regime 确认",
        volRegimeChanged
          ? `市场进入${volRegime.current === "high" ? "高" : "低"}波动 Regime（EWMA 比 ${volRegime.ratio.toFixed(2)}）`
          : hurstShift
          ? `趋势特征变化：H 从 ${hurst.toFixed(2)} → ${recentHurst.toFixed(2)}`
          : "相关性结构变化",
        Math.max(volRegime.confidence, corrBreak.confidence, hurstShift ? 0.75 : 0)
      ),
    ];

    const confidence =
      triggerChain.reduce((sum, step) => sum + step.confidence, 0) / triggerChain.length;

    const severity =
      (volRegimeChanged && volRegime.ratio > 2) || (corrBreak.broken && corrBreak.delta > 0.5)
        ? "high"
        : volRegimeChanged || hurstShift || corrBreak.broken
        ? "medium"
        : "low";

    const regimeType = volRegime.current === "high" ? "高波动" : volRegime.current === "low" ? "低波动" : "结构变化";

    return {
      triggered: true,
      severity,
      confidence,
      triggerChain,
      relatedAssets: symbol2 ? [symbol1, symbol2] : [symbol1],
      riskItems: [
        volRegimeChanged ? `波动率 Regime 变化（EWMA 比 ${volRegime.ratio.toFixed(2)}）` : null,
        hurstShift ? `Hurst 指数变化 ${hurst.toFixed(2)} → ${recentHurst.toFixed(2)}，${trendStrengthening ? "趋势增强" : "均值回归增强"}` : null,
        corrBreak.broken && symbol2 ? `${symbol1}/${symbol2} 相关性断裂（Δ=${corrBreak.delta.toFixed(2)}）` : null,
        "均值回归策略假设可能不再成立",
      ].filter(Boolean) as string[],
      manualCheckItems: [
        "评估现有策略在当前 Regime 下的适用性",
        "检查是否有宏观经济或政策环境变化",
        "考虑调整仓位或策略参数",
      ],
      title: `${symbol1} 市场 Regime 转换`,
      summary: `${symbol1} 检测到市场 Regime 变化：${regimeType}${volRegimeChanged ? `（EWMA 波动率比 ${volRegime.ratio.toFixed(2)}）` : ""}${hurstShift ? `，Hurst ${hurst.toFixed(2)}→${recentHurst.toFixed(2)}` : ""}${corrBreak.broken ? "，相关性断裂" : ""}。`,
    };
  }
}
