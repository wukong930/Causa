/**
 * Cost Model — computes production cost floor from raw material prices.
 *
 * For domestic production: cost = Σ(input_price × weight) + fees
 * For import parity: cost = foreign_price × FX × (1+tariff) × (1+VAT) + fees
 *
 * Signal: price near/below cost floor → bullish support
 *         price far above cost floor → no signal (neutral)
 */

import type { FactorResult, FactorDirection } from "@/types/domain";
import type { CostFormula } from "../configs/types";

export function evaluateCost(
  symbol: string,
  currentPrice: number,
  formula: CostFormula,
  inputPrices: Map<string, number>,
  fxRate?: number,
): FactorResult {
  let availableInputs = 0;
  let totalInputs = formula.inputs.length;
  let rawMaterialCost = 0;

  for (const input of formula.inputs) {
    const price = inputPrices.get(input.symbol);
    if (price != null) {
      rawMaterialCost += price * input.weight;
      availableInputs++;
    }
  }

  // Data quality: fraction of inputs available
  const dataQuality = totalInputs > 0 ? availableInputs / totalInputs : 0;

  if (dataQuality === 0) {
    return {
      name: "cost",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "daily",
      description: `${formula.label}: 缺少原料价格数据`,
    };
  }

  // Scale up if partial data (assume missing inputs proportional)
  const scaledCost = totalInputs > 0
    ? (rawMaterialCost / availableInputs) * totalInputs
    : rawMaterialCost;

  let costFloor = scaledCost + formula.fees;

  // Import parity adjustment
  if (formula.tariff != null) {
    costFloor *= (1 + formula.tariff);
  }
  if (formula.vat != null) {
    costFloor *= (1 + formula.vat);
  }
  if (formula.fxSymbol && fxRate) {
    costFloor *= fxRate;
  }

  // Direction: bullish if price near/below cost, neutral if far above
  const costRatio = (currentPrice - costFloor) / costFloor;
  let direction: FactorDirection = 0;
  let strength = 0;

  if (costRatio <= 0) {
    // Below cost floor — strong bullish support
    direction = 1;
    strength = Math.min(1, Math.abs(costRatio) * 5 + 0.7);
  } else if (costRatio < 0.05) {
    // Within 5% of cost — moderate bullish support
    direction = 1;
    strength = 0.5 * (1 - costRatio / 0.05);
  }
  // Above 5% → neutral (direction = 0)

  return {
    name: "cost",
    direction,
    strength,
    dataQuality,
    timeframe: "daily",
    description: direction === 1
      ? `${formula.label}: 盘面${costRatio <= 0 ? "低于" : "接近"}成本线 (成本${costFloor.toFixed(0)}, 盘面${currentPrice.toFixed(0)}, ${(costRatio * 100).toFixed(1)}%)`
      : `${formula.label}: 盘面高于成本线${(costRatio * 100).toFixed(1)}%`,
  };
}

/** Extract the computed cost floor value */
export function computeCostFloor(
  formula: CostFormula,
  inputPrices: Map<string, number>,
  fxRate?: number,
): number | undefined {
  let rawMaterialCost = 0;
  let available = 0;

  for (const input of formula.inputs) {
    const price = inputPrices.get(input.symbol);
    if (price != null) {
      rawMaterialCost += price * input.weight;
      available++;
    }
  }

  if (available === 0) return undefined;

  const scaled = (rawMaterialCost / available) * formula.inputs.length;
  let cost = scaled + formula.fees;
  if (formula.tariff != null) cost *= (1 + formula.tariff);
  if (formula.vat != null) cost *= (1 + formula.vat);
  if (formula.fxSymbol && fxRate) cost *= fxRate;

  return cost;
}
