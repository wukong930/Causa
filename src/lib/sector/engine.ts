/**
 * Sector Intelligence Engine — orchestrates factor models and conviction scoring.
 *
 * evaluateSector(symbol, prices, inventoryData?) → SectorAssessment
 *
 * 1. Look up sector config via registry
 * 2. Run applicable factor models (cost, margin, inventory, seasonal, substitute)
 * 3. Aggregate via conviction scoring
 * 4. Return SectorAssessment with all factor details
 */

import type { FactorResult, SectorAssessment } from "@/types/domain";
import type { SectorConfig } from "./configs/types";
import { getSectorConfig } from "./configs/registry";
import { evaluateCost, computeCostFloor } from "./models/cost";
import { evaluateMargin } from "./models/margin";
import { evaluateInventory, type InventoryDataPoint } from "./models/inventory";
import { evaluateSeasonal } from "./models/seasonal";
import { evaluateSubstitute } from "./models/substitute";
import { computeConviction } from "./conviction";

export interface SectorEngineInput {
  symbol: string;
  /** Current market prices keyed by symbol */
  prices: Map<string, number>;
  /** Optional inventory history for the symbol */
  inventoryData?: InventoryDataPoint[];
  /** Optional seasonal baseline override */
  seasonalBaseline?: number;
  /** Optional FX rate for import parity cost models */
  fxRate?: number;
  /** Override current month (1-12) for testing */
  currentMonth?: number;
}

export function evaluateSector(input: SectorEngineInput): SectorAssessment | null {
  const config = getSectorConfig(input.symbol);
  if (!config) return null;

  const factors: FactorResult[] = [];
  let costFloor: number | undefined;
  let productionMargin: number | undefined;
  let inventoryDeviation: number | undefined;
  let seasonalFactor: number | undefined;

  // ── Cost Model ──
  const costFormula = config.costFormulas[input.symbol];
  const currentPrice = input.prices.get(input.symbol);
  if (costFormula && currentPrice != null) {
    factors.push(evaluateCost(input.symbol, currentPrice, costFormula, input.prices, input.fxRate));
    costFloor = computeCostFloor(costFormula, input.prices, input.fxRate);
  }

  // ── Margin Model ──
  const marginFormula = config.marginFormulas[input.symbol];
  if (marginFormula) {
    const marginResult = evaluateMargin(marginFormula, input.prices);
    factors.push(marginResult);
    // Extract margin value from description for storage
    const marginMatch = marginResult.description.match(/([-\d.]+)元\/吨/);
    if (marginMatch) productionMargin = parseFloat(marginMatch[1]);
  }

  // ── Inventory Model ──
  const invResult = evaluateInventory(input.symbol, input.inventoryData ?? [], input.seasonalBaseline);
  factors.push(invResult);
  // Extract deviation from description
  const devMatch = invResult.description.match(/偏差([+-]?[\d.]+)%/);
  if (devMatch) inventoryDeviation = parseFloat(devMatch[1]) / 100;

  // ── Seasonal Model ──
  const seasResult = evaluateSeasonal(input.symbol, config.seasonalPatterns, input.currentMonth);
  factors.push(seasResult);
  seasonalFactor = seasResult.direction * seasResult.strength;

  // ── Substitute Model ──
  factors.push(evaluateSubstitute(input.symbol, config.substitutePairs, input.prices));

  // ── Conviction Scoring ──
  const conviction = computeConviction(factors, config.factorWeights);

  return {
    sectorId: config.id,
    symbol: input.symbol,
    conviction,
    costFloor,
    productionMargin,
    inventoryDeviation,
    seasonalFactor,
    computedAt: new Date().toISOString(),
  };
}

/** Evaluate all symbols in a sector */
export function evaluateSectorBatch(
  sectorConfig: SectorConfig,
  prices: Map<string, number>,
  inventoryMap?: Map<string, InventoryDataPoint[]>,
  fxRate?: number,
  currentMonth?: number,
): SectorAssessment[] {
  return sectorConfig.symbols
    .map((symbol) =>
      evaluateSector({
        symbol,
        prices,
        inventoryData: inventoryMap?.get(symbol),
        fxRate,
        currentMonth,
      })
    )
    .filter((a): a is SectorAssessment => a !== null);
}
