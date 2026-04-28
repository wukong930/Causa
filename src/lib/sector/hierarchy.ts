/**
 * Alert Hierarchy — L0 market overview + L1 sector assessment generation.
 *
 * L0: "今日3个板块有活跃信号: 黑色(偏空72%), 能化(中性), 农产品(偏多65%)"
 * L1: "黑色板块偏空 | 钢厂利润-150(亏损), 库存累积, 淡季"
 *
 * Consumes SectorAssessment[] and produces structured summaries.
 */

import type { SectorAssessment, FactorDirection, AlertCategory } from "@/types/domain";
import { CATEGORY_LABEL } from "@/lib/constants";

// ─── L0: Market Overview ────────────────────────────────────────────────────

export interface MarketOverview {
  /** One-line summary */
  summary: string;
  /** Per-sector snapshots */
  sectors: SectorSnapshot[];
  /** Total active signals across all sectors */
  totalSignals: number;
  generatedAt: string;
}

export interface SectorSnapshot {
  sectorId: AlertCategory;
  sectorName: string;
  direction: FactorDirection;
  directionLabel: string;
  convictionPct: number;
  symbolCount: number;
  activeSignals: number;
  topSymbol?: string;
  topSymbolConviction?: number;
}

export function generateMarketOverview(assessments: SectorAssessment[]): MarketOverview {
  // Group by sector
  const bySector = new Map<AlertCategory, SectorAssessment[]>();
  for (const a of assessments) {
    const list = bySector.get(a.sectorId) ?? [];
    list.push(a);
    bySector.set(a.sectorId, list);
  }

  const sectors: SectorSnapshot[] = [];
  let totalSignals = 0;

  for (const [sectorId, items] of bySector) {
    const activeItems = items.filter((a) => a.conviction.score > 0.3);
    totalSignals += activeItems.length;

    // Weighted average conviction across symbols
    let dirSum = 0;
    let scoreSum = 0;
    for (const a of items) {
      dirSum += a.conviction.overallDirection * a.conviction.score;
      scoreSum += a.conviction.score;
    }

    const avgDir = scoreSum > 0 ? dirSum / scoreSum : 0;
    const direction: FactorDirection = avgDir > 0.05 ? 1 : avgDir < -0.05 ? -1 : 0;
    const convictionPct = Math.round((scoreSum / items.length) * 100);

    // Top symbol by conviction
    const sorted = [...items].sort((a, b) => b.conviction.score - a.conviction.score);
    const top = sorted[0];

    sectors.push({
      sectorId,
      sectorName: CATEGORY_LABEL[sectorId] ?? sectorId,
      direction,
      directionLabel: direction === 1 ? "偏多" : direction === -1 ? "偏空" : "中性",
      convictionPct,
      symbolCount: items.length,
      activeSignals: activeItems.length,
      topSymbol: top?.symbol,
      topSymbolConviction: top ? Math.round(top.conviction.score * 100) : undefined,
    });
  }

  // Sort: sectors with signals first, then by conviction
  sectors.sort((a, b) => b.activeSignals - a.activeSignals || b.convictionPct - a.convictionPct);

  const activeSectors = sectors.filter((s) => s.activeSignals > 0);
  const summary = activeSectors.length > 0
    ? `今日${activeSectors.length}个板块有活跃信号: ${activeSectors.map((s) => `${s.sectorName}(${s.directionLabel}${s.convictionPct}%)`).join(", ")}`
    : "今日各板块无明显信号";

  return { summary, sectors, totalSignals, generatedAt: new Date().toISOString() };
}

// ─── L1: Sector Detail ──────────────────────────────────────────────────────

export interface SectorDetail {
  sectorId: AlertCategory;
  sectorName: string;
  summary: string;
  direction: FactorDirection;
  directionLabel: string;
  avgConviction: number;
  symbols: SymbolAssessmentSummary[];
  keyFactors: string[];
  dataGaps: string[];
}

export interface SymbolAssessmentSummary {
  symbol: string;
  direction: FactorDirection;
  directionLabel: string;
  convictionPct: number;
  costFloor?: number;
  productionMargin?: number;
  inventoryDeviation?: number;
  seasonalFactor?: number;
  topFactor?: string;
}

export function generateSectorDetail(
  sectorId: AlertCategory,
  assessments: SectorAssessment[],
): SectorDetail {
  const sectorName = CATEGORY_LABEL[sectorId] ?? sectorId;
  const items = assessments.filter((a) => a.sectorId === sectorId);

  if (items.length === 0) {
    return {
      sectorId, sectorName, summary: `${sectorName}板块暂无评估数据`,
      direction: 0, directionLabel: "中性", avgConviction: 0,
      symbols: [], keyFactors: [], dataGaps: [],
    };
  }

  // Aggregate direction
  let dirSum = 0;
  let scoreSum = 0;
  const allGaps: string[] = [];
  const factorCounts = new Map<string, number>();

  const symbols: SymbolAssessmentSummary[] = items.map((a) => {
    dirSum += a.conviction.overallDirection * a.conviction.score;
    scoreSum += a.conviction.score;
    allGaps.push(...a.conviction.dataGaps);

    // Count supporting factors
    for (const f of a.conviction.supportingFactors) {
      factorCounts.set(f.description, (factorCounts.get(f.description) ?? 0) + 1);
    }

    const topFactor = a.conviction.supportingFactors[0]?.description
      ?? a.conviction.opposingFactors[0]?.description;

    return {
      symbol: a.symbol,
      direction: a.conviction.overallDirection,
      directionLabel: a.conviction.overallDirection === 1 ? "偏多" : a.conviction.overallDirection === -1 ? "偏空" : "中性",
      convictionPct: Math.round(a.conviction.score * 100),
      costFloor: a.costFloor,
      productionMargin: a.productionMargin,
      inventoryDeviation: a.inventoryDeviation,
      seasonalFactor: a.seasonalFactor,
      topFactor,
    };
  });

  symbols.sort((a, b) => b.convictionPct - a.convictionPct);

  const avgDir = scoreSum > 0 ? dirSum / scoreSum : 0;
  const direction: FactorDirection = avgDir > 0.05 ? 1 : avgDir < -0.05 ? -1 : 0;
  const directionLabel = direction === 1 ? "偏多" : direction === -1 ? "偏空" : "中性";
  const avgConviction = Math.round((scoreSum / items.length) * 100);

  // Top factors across the sector
  const keyFactors = [...factorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([desc]) => desc);

  const uniqueGaps = [...new Set(allGaps)];

  // Build summary line
  const parts: string[] = [`${sectorName}板块${directionLabel}`];
  if (symbols[0]) parts.push(`${symbols[0].symbol}确信度最高(${symbols[0].convictionPct}%)`);
  if (keyFactors[0]) parts.push(keyFactors[0]);
  const summary = parts.join(" | ");

  return {
    sectorId, sectorName, summary, direction, directionLabel, avgConviction,
    symbols, keyFactors, dataGaps: uniqueGaps,
  };
}
