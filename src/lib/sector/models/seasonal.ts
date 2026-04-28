/**
 * Seasonal Model — pure config-driven seasonal adjustment.
 *
 * Checks current month against peak/trough definitions.
 * No external data needed, so dataQuality is always 1.0.
 *
 * Signal: peak month → demand strong → bullish
 *         trough month → demand weak → bearish
 *         transition month → neutral
 */

import type { FactorResult, FactorDirection } from "@/types/domain";
import type { SeasonalPattern } from "../configs/types";

export function evaluateSeasonal(
  symbol: string,
  patterns: SeasonalPattern[],
  currentMonth?: number,
): FactorResult {
  const month = currentMonth ?? (new Date().getMonth() + 1); // 1-12
  const pattern = patterns.find((p) => p.symbol === symbol);

  if (!pattern) {
    return {
      name: "seasonal",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "monthly",
      description: `${symbol}: 无季节性配置`,
    };
  }

  const isPeak = pattern.peakMonths.includes(month);
  const isTrough = pattern.troughMonths.includes(month);

  let direction: FactorDirection = 0;
  let strength = 0;

  if (isPeak) {
    direction = 1;  // bullish — demand strong
    strength = 0.6;
  } else if (isTrough) {
    direction = -1;  // bearish — demand weak
    strength = 0.6;
  }
  // Transition months: direction = 0, strength = 0

  // Boost strength if we're in the middle of peak/trough (not edge month)
  if (isPeak && pattern.peakMonths.length >= 3) {
    const idx = pattern.peakMonths.indexOf(month);
    const mid = Math.floor(pattern.peakMonths.length / 2);
    if (idx === mid) strength = 0.8;
  }
  if (isTrough && pattern.troughMonths.length >= 3) {
    const idx = pattern.troughMonths.indexOf(month);
    const mid = Math.floor(pattern.troughMonths.length / 2);
    if (idx === mid) strength = 0.8;
  }

  const phaseLabel = isPeak ? "旺季" : isTrough ? "淡季" : "过渡期";

  return {
    name: "seasonal",
    direction,
    strength,
    dataQuality: 1.0,  // config-driven, always available
    timeframe: "monthly",
    description: `${symbol}: ${month}月处于${phaseLabel} — ${pattern.description}`,
  };
}
