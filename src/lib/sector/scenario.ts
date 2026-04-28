/**
 * Scenario Analysis Engine — what-if simulation.
 *
 * User inputs: "铁矿石价格上涨20%"
 * → Apply price shock to base prices
 * → Re-run sector engine for affected symbols
 * → Run propagation graph simulation
 * → Output structured impact report
 */

import type { SectorAssessment, FactorDirection, RelationshipEdge } from "@/types/domain";
import { evaluateSector, type SectorEngineInput } from "./engine";
import { propagateSignal, type PropagationAlert } from "./propagation";
import { getSectorConfig, getAllSectorConfigs } from "./configs/registry";
import { COMMODITY_NAME_MAP } from "@/lib/constants";

// ─── Input / Output types ───────────────────────────────────────────────────

export interface ScenarioAssumption {
  symbol: string;
  /** Price change as decimal: 0.20 = +20%, -0.15 = -15% */
  priceChangePct: number;
}

export interface ScenarioResult {
  assumptions: ScenarioAssumption[];
  /** Direct impact: re-evaluated sector assessments for shocked symbols */
  directImpacts: SymbolImpact[];
  /** Indirect impact: propagation through supply chain */
  propagationImpacts: PropagationAlert[];
  /** One-line summary */
  summary: string;
  computedAt: string;
}

export interface SymbolImpact {
  symbol: string;
  symbolName: string;
  /** Assessment BEFORE the shock */
  before: AssessmentSnapshot;
  /** Assessment AFTER the shock */
  after: AssessmentSnapshot;
  /** Change in conviction score */
  convictionDelta: number;
  /** Direction changed? */
  directionChanged: boolean;
}

export interface AssessmentSnapshot {
  direction: FactorDirection;
  directionLabel: string;
  convictionPct: number;
  costFloor?: number;
  productionMargin?: number;
}

/* ── PLACEHOLDER_RUN ── */

export interface ScenarioInput {
  assumptions: ScenarioAssumption[];
  /** Base prices for all symbols (current market) */
  basePrices: Map<string, number>;
  /** Graph edges for propagation */
  edges: RelationshipEdge[];
  /** Existing assessments for comparison (optional) */
  baseAssessments?: Map<string, SectorAssessment>;
}

export function runScenario(input: ScenarioInput): ScenarioResult {
  const { assumptions, basePrices, edges, baseAssessments } = input;

  // 1. Build shocked price map
  const shockedPrices = new Map(basePrices);
  for (const a of assumptions) {
    const base = basePrices.get(a.symbol);
    if (base != null) {
      shockedPrices.set(a.symbol, base * (1 + a.priceChangePct));
    }
  }

  // 2. Identify all symbols that need re-evaluation
  //    (shocked symbols + their downstream via edges)
  const affectedSymbols = new Set<string>();
  for (const a of assumptions) {
    affectedSymbols.add(a.symbol);
    // Add direct downstream
    for (const e of edges) {
      if (e.source === a.symbol && e.influenceWeight != null) {
        affectedSymbols.add(e.target);
      }
    }
  }

  // Also add symbols that share a sector with shocked symbols
  for (const a of assumptions) {
    const config = getSectorConfig(a.symbol);
    if (config) {
      for (const s of config.symbols) affectedSymbols.add(s);
    }
  }

  // 3. Re-evaluate affected symbols with shocked prices
  const directImpacts: SymbolImpact[] = [];

  for (const symbol of affectedSymbols) {
    const beforeAssessment = baseAssessments?.get(symbol)
      ?? evaluateSector({ symbol, prices: basePrices });
    const afterAssessment = evaluateSector({ symbol, prices: shockedPrices });

    if (!beforeAssessment || !afterAssessment) continue;

    const before = toSnapshot(beforeAssessment);
    const after = toSnapshot(afterAssessment);
    const convictionDelta = after.convictionPct - before.convictionPct;
    const directionChanged = before.direction !== after.direction;

    // Only include if there's meaningful change
    if (Math.abs(convictionDelta) >= 3 || directionChanged) {
      directImpacts.push({
        symbol,
        symbolName: COMMODITY_NAME_MAP[symbol] ?? symbol,
        before,
        after,
        convictionDelta,
        directionChanged,
      });
    }
  }

  // Sort by absolute conviction change descending
  directImpacts.sort((a, b) => Math.abs(b.convictionDelta) - Math.abs(a.convictionDelta));

  // 4. Run propagation for each assumption
  const allPropagations: PropagationAlert[] = [];
  for (const a of assumptions) {
    const direction: FactorDirection = a.priceChangePct > 0 ? 1 : a.priceChangePct < 0 ? -1 : 0;
    const strength = Math.min(1, Math.abs(a.priceChangePct) * 2);

    const propagations = propagateSignal({
      sourceSymbol: a.symbol,
      signalStrength: strength,
      signalDirection: direction,
      edges,
      assessments: baseAssessments,
    });
    allPropagations.push(...propagations);
  }

  // Deduplicate propagations by target (keep strongest)
  const propMap = new Map<string, PropagationAlert>();
  for (const p of allPropagations) {
    const existing = propMap.get(p.targetSymbol);
    if (!existing || p.impactStrength > existing.impactStrength) {
      propMap.set(p.targetSymbol, p);
    }
  }
  const propagationImpacts = [...propMap.values()].sort(
    (a, b) => b.impactStrength - a.impactStrength,
  );

  // 5. Build summary
  const assumptionStr = assumptions
    .map((a) => `${COMMODITY_NAME_MAP[a.symbol] ?? a.symbol}${a.priceChangePct > 0 ? "+" : ""}${(a.priceChangePct * 100).toFixed(0)}%`)
    .join(", ");

  const impactedCount = directImpacts.length + propagationImpacts.length;
  const dirChanges = directImpacts.filter((d) => d.directionChanged);

  let summary = `假设 ${assumptionStr} → 影响 ${impactedCount} 个品种`;
  if (dirChanges.length > 0) {
    summary += `, ${dirChanges.length} 个品种方向翻转(${dirChanges.map((d) => d.symbol).join("/")})`;
  }

  return {
    assumptions,
    directImpacts,
    propagationImpacts,
    summary,
    computedAt: new Date().toISOString(),
  };
}

function toSnapshot(a: SectorAssessment): AssessmentSnapshot {
  return {
    direction: a.conviction.overallDirection,
    directionLabel: a.conviction.overallDirection === 1 ? "偏多" : a.conviction.overallDirection === -1 ? "偏空" : "中性",
    convictionPct: Math.round(a.conviction.score * 100),
    costFloor: a.costFloor,
    productionMargin: a.productionMargin,
  };
}
