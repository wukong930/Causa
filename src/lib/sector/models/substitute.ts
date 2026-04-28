/**
 * Substitute Model — tracks price spread between substitute commodities.
 *
 * When the spread between two substitutes exceeds a threshold,
 * downstream consumers switch to the cheaper alternative.
 *
 * Signal: spread > threshold → substitution pressure on the expensive one (bearish)
 *         spread < -threshold → reverse substitution pressure
 */

import type { FactorResult, FactorDirection } from "@/types/domain";
import type { SubstitutePair } from "../configs/types";

export function evaluateSubstitute(
  symbol: string,
  pairs: SubstitutePair[],
  prices: Map<string, number>,
): FactorResult {
  // Find pairs involving this symbol
  const relevantPairs = pairs.filter(
    (p) => p.symbolA === symbol || p.symbolB === symbol
  );

  if (relevantPairs.length === 0) {
    return {
      name: "substitute",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "daily",
      description: `${symbol}: 无替代品配置`,
    };
  }

  // Evaluate the first relevant pair (primary substitute)
  const pair = relevantPairs[0];
  const priceA = prices.get(pair.symbolA);
  const priceB = prices.get(pair.symbolB);

  if (priceA == null || priceB == null) {
    return {
      name: "substitute",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "daily",
      description: `${pair.label}: 缺少价格数据 (${pair.symbolA}/${pair.symbolB})`,
    };
  }

  const spread = priceA - priceB;
  const absSpread = Math.abs(spread);
  const spreadRatio = absSpread / pair.threshold;

  let direction: FactorDirection = 0;
  let strength = 0;

  const isSymbolA = symbol === pair.symbolA;

  if (spreadRatio > 1.0) {
    // Spread exceeds threshold — substitution pressure
    if (spread > 0) {
      // A is more expensive → bearish for A, bullish for B
      direction = isSymbolA ? -1 : 1;
    } else {
      // B is more expensive → bullish for A, bearish for B
      direction = isSymbolA ? 1 : -1;
    }
    strength = Math.min(1, (spreadRatio - 1.0) * 2 + 0.4);
  } else if (spreadRatio > 0.7) {
    // Approaching threshold — mild pressure
    if (spread > 0) {
      direction = isSymbolA ? -1 : 1;
    } else {
      direction = isSymbolA ? 1 : -1;
    }
    strength = 0.2;
  }
  // Below 0.7 → no substitution pressure

  if (pair.direction === "negative") {
    direction = (direction * -1) as FactorDirection;
  }

  return {
    name: "substitute",
    direction,
    strength,
    dataQuality: 1.0,
    timeframe: "daily",
    description: `${pair.label}: 价差${spread.toFixed(0)} (阈值${pair.threshold}, ${(spreadRatio * 100).toFixed(0)}%)${spreadRatio > 1 ? " 替代压力" : ""}`,
  };
}
