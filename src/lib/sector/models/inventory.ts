/**
 * Inventory Model — compares current inventory against seasonal baseline.
 *
 * Uses industry_data from DB (dataType = 'inventory').
 * Computes deviation from seasonal average to determine if supply is tight or loose.
 *
 * Signal: inventory below seasonal → supply tight → bullish
 *         inventory above seasonal → supply loose → bearish
 */

import type { FactorResult, FactorDirection } from "@/types/domain";

export interface InventoryDataPoint {
  value: number;
  date: string;
}

export function evaluateInventory(
  symbol: string,
  inventoryData: InventoryDataPoint[],
  seasonalBaseline?: number,
): FactorResult {
  if (!inventoryData || inventoryData.length === 0) {
    return {
      name: "inventory",
      direction: 0,
      strength: 0,
      dataQuality: 0,
      timeframe: "weekly",
      description: `${symbol}: 无库存数据`,
    };
  }

  // Sort by date descending, take latest
  const sorted = [...inventoryData].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const current = latest.value;

  // If we have enough history, compute simple seasonal baseline
  // (average of same-month values from history)
  let baseline = seasonalBaseline;
  if (baseline == null && sorted.length >= 10) {
    const currentMonth = new Date(latest.date).getMonth();
    const sameMonthValues = sorted
      .filter((d) => new Date(d.date).getMonth() === currentMonth)
      .map((d) => d.value);
    if (sameMonthValues.length >= 2) {
      baseline = sameMonthValues.reduce((a, b) => a + b, 0) / sameMonthValues.length;
    }
  }

  // Fallback: use overall average as baseline
  if (baseline == null) {
    baseline = sorted.reduce((sum, d) => sum + d.value, 0) / sorted.length;
  }

  // Compute deviation
  const deviation = baseline > 0 ? (current - baseline) / baseline : 0;

  // Trend: check last 3-4 data points for direction
  let trend: "accumulating" | "depleting" | "flat" = "flat";
  if (sorted.length >= 3) {
    const recent = sorted.slice(0, 3).map((d) => d.value);
    const diffs = recent.slice(0, -1).map((v, i) => v - recent[i + 1]);
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    if (avgDiff > baseline * 0.01) trend = "accumulating";
    else if (avgDiff < -baseline * 0.01) trend = "depleting";
  }

  let direction: FactorDirection = 0;
  let strength = 0;

  if (deviation < -0.10) {
    // Below seasonal by >10% → supply tight → bullish
    direction = 1;
    strength = Math.min(1, Math.abs(deviation) * 3);
    if (trend === "depleting") strength = Math.min(1, strength * 1.3);
  } else if (deviation > 0.10) {
    // Above seasonal by >10% → supply loose → bearish
    direction = -1;
    strength = Math.min(1, deviation * 3);
    if (trend === "accumulating") strength = Math.min(1, strength * 1.3);
  }

  const trendLabel = trend === "accumulating" ? "累库" : trend === "depleting" ? "去库" : "持平";

  return {
    name: "inventory",
    direction,
    strength,
    dataQuality: sorted.length >= 5 ? 1.0 : sorted.length >= 2 ? 0.6 : 0.3,
    timeframe: "weekly",
    description: `${symbol}库存: ${current.toFixed(0)} (季节性偏差${deviation > 0 ? "+" : ""}${(deviation * 100).toFixed(1)}%, ${trendLabel})`,
  };
}
