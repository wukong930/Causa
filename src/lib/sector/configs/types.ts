/**
 * Sector configuration types for the Sector Intelligence Layer.
 *
 * Each sector (ferrous, energy, agriculture) has a config that defines:
 * - Cost formulas (raw material → production cost)
 * - Margin formulas (product price - raw material cost - processing)
 * - Seasonal patterns (peak/trough months)
 * - Substitute pairs (substitution threshold)
 * - Factor weights with timeframe attribution
 */

import type { AlertCategory, Timeframe } from "@/types/domain";

// ─── Cost Model ─────────────────────────────────────────────────────────────

export interface CostInput {
  symbol: string;
  weight: number;   // coefficient (e.g., 1.6 for iron ore in steel)
  label: string;
}

export interface CostFormula {
  label: string;
  inputs: CostInput[];
  fees: number;          // processing + misc costs (CNY/ton)
  tariff?: number;       // import tariff rate (e.g., 0.20 = 20%)
  vat?: number;          // VAT rate (e.g., 0.13 = 13%)
  fxSymbol?: string;     // FX pair for import parity (e.g., "USDCNY")
}

// ─── Margin Model ───────────────────────────────────────────────────────────

export interface MarginFormula {
  label: string;
  product: { symbol: string; coefficient: number };
  rawMaterials: Array<{ symbol: string; coefficient: number }>;
  processingCost: number;
}

// ─── Seasonal Model ─────────────────────────────────────────────────────────

export interface SeasonalPattern {
  symbol: string;
  peakMonths: number[];    // 1-12
  troughMonths: number[];  // 1-12
  description: string;
}

// ─── Substitute Model ───────────────────────────────────────────────────────

export interface SubstitutePair {
  symbolA: string;
  symbolB: string;
  threshold: number;       // spread at which substitution kicks in
  direction: "positive" | "negative";  // positive = same direction, negative = inverse
  label: string;
}

// ─── Factor Weights ─────────────────────────────────────────────────────────

export interface FactorWeight {
  weight: number;          // 0-1, relative importance
  timeframe: Timeframe;
}

// ─── Sector Config ──────────────────────────────────────────────────────────

export interface SectorConfig {
  id: AlertCategory;
  name: string;
  symbols: string[];
  costFormulas: Record<string, CostFormula>;
  marginFormulas: Record<string, MarginFormula>;
  seasonalPatterns: SeasonalPattern[];
  substitutePairs: SubstitutePair[];
  factorWeights: Record<string, FactorWeight>;
}
