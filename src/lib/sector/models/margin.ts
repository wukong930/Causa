/**
 * Margin Model — computes production profit/loss.
 *
 * margin = product_price × coefficient - Σ(raw_material_price × coefficient) - processingCost
 *
 * Signal: negative margin → production cuts likely → bullish for product
 *         very high margin → expansion likely → bearish for product
 */

import type { FactorResult, FactorDirection } from "@/types/domain";
import type { MarginFormula } from "../configs/types";

export function evaluateMargin(
  formula: MarginFormula,
  prices: Map<string, number>,
): FactorResult {
  const productPrice = prices.get(formula.product.symbol);
  if (productPrice == null) {
    return {
      name: "margin",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "daily",
      description: `${formula.label}: 缺少产品价格`,
    };
  }

  let rawCost = 0;
  let available = 0;
  for (const rm of formula.rawMaterials) {
    const price = prices.get(rm.symbol);
    if (price != null) {
      rawCost += price * rm.coefficient;
      available++;
    }
  }

  const dataQuality = formula.rawMaterials.length > 0
    ? (available + 1) / (formula.rawMaterials.length + 1)  // +1 for product
    : 1;

  if (available === 0) {
    return {
      name: "margin",
      direction: 0,
      strength: 0,
      dataQuality: dataQuality,
      timeframe: "daily",
      description: `${formula.label}: 缺少原料价格`,
    };
  }

  // Scale raw cost if partial data
  if (available < formula.rawMaterials.length) {
    rawCost = (rawCost / available) * formula.rawMaterials.length;
  }

  const margin = productPrice * formula.product.coefficient - rawCost - formula.processingCost;
  const marginRate = margin / (rawCost + formula.processingCost);

  let direction: FactorDirection = 0;
  let strength = 0;

  if (margin < 0) {
    // Negative margin → production cuts → bullish for product
    direction = 1;
    strength = Math.min(1, Math.abs(marginRate) * 3 + 0.5);
  } else if (marginRate > 0.30) {
    // Very high margin (>30%) → expansion → bearish for product
    direction = -1;
    strength = Math.min(1, (marginRate - 0.30) * 3 + 0.3);
  } else if (marginRate > 0.15) {
    // Healthy margin → neutral to slightly bearish
    direction = 0;
    strength = 0;
  } else {
    // Low but positive margin → slightly bullish
    direction = 1;
    strength = 0.2 * (1 - marginRate / 0.15);
  }

  return {
    name: "margin",
    direction,
    strength,
    dataQuality,
    timeframe: "daily",
    description: `${formula.label}: ${margin.toFixed(0)}元/吨 (${(marginRate * 100).toFixed(1)}%)${margin < 0 ? " 亏损" : ""}`,
  };
}
