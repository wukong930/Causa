import type { Direction, AlertCategory } from "@/types/domain";
import type { PositionGroup, AccountSnapshot } from "@/types/domain";
import type { TriggerContext, RiskParameters } from "./base";

/** Commodity → category mapping (simple heuristic based on symbol prefix) */
const CATEGORY_MAP: Record<string, AlertCategory> = {
  RB: "ferrous",
  HC: "ferrous",
  I: "ferrous",
  J: "ferrous",
  JM: "energy",
 焦炭: "energy",
 焦煤: "energy",
  CU: "nonferrous",
  AL: "nonferrous",
  ZN: "nonferrous",
  NI: "nonferrous",
  AU: "nonferrous",
  AG: "nonferrous",
  SC: "energy",
 原油: "energy",
  FU: "energy",
  螺纹: "ferrous",
  热卷: "ferrous",
  铁矿: "ferrous",
  沪铜: "nonferrous",
  沪铝: "nonferrous",
};

function inferCategory(symbol: string): AlertCategory {
  const prefix = symbol.replace(/\d+/, "");
  return CATEGORY_MAP[prefix] ?? "ferrous";
}

const DEFAULTS: RiskParameters = {
  maxPositionSizePerCommodity: 10,
  maxMarginUtilization: 0.80,
  maxConcentrationPerCategory: 0.40,
};

function mergeRiskParams(params?: RiskParameters): RiskParameters {
  return { ...DEFAULTS, ...params };
}

// ─── Direction conflict detection ─────────────────────────────────────────────

export interface DirectionConflict {
  asset: string;
  proposedDirection: Direction;
  existingDirection: Direction;
  existingPositionId: string;
  message: string;
}

/**
 * Detect if any proposed leg direction conflicts with existing open positions.
 * A conflict is: same asset, opposite direction (long vs short).
 */
export function detectDirectionConflicts(
  legs: Array<{ asset: string; direction: Direction }>,
  positions: PositionGroup[]
): DirectionConflict[] {
  const conflicts: DirectionConflict[] = [];

  for (const leg of legs) {
    for (const pos of positions) {
      if (pos.status !== "open") continue;
      for (const posLeg of pos.legs) {
        if (posLeg.asset !== leg.asset) continue;
        if (posLeg.direction === leg.direction) continue; // same direction is fine

        // Determine which is existing and which is proposed
        const existingDir = posLeg.direction;
        const proposedDir = leg.direction;

        // Skip if existing position is already closing
        // (positions don't have a closing flag, but we check via position group status)
        conflicts.push({
          asset: leg.asset,
          proposedDirection: proposedDir,
          existingDirection: existingDir,
          existingPositionId: pos.id,
          message: `方向冲突：${leg.asset} 已持${existingDir === "long" ? "多" : "空"}仓（来自策略「${pos.strategyName ?? pos.id}」），新提案为${proposedDir === "long" ? "做多" : "做空"}`,
        });
      }
    }
  }

  return conflicts;
}

// ─── Margin utilization check ─────────────────────────────────────────────────

export interface MarginCheck {
  ok: boolean;
  current: number;      // current utilization ratio
  projected: number;    // projected utilization ratio after this trade
  message: string;
}

export function checkMarginUtilization(
  proposedMargin: number,
  account: AccountSnapshot,
  params: RiskParameters
): MarginCheck {
  const netValue = account.netValue;
  const currentUsed = account.netValue * account.marginUtilizationRate;
  const projectedUsed = currentUsed + proposedMargin;
  const projected = netValue > 0 ? projectedUsed / netValue : 1;

  if (projected > params.maxMarginUtilization) {
    return {
      ok: false,
      current: account.marginUtilizationRate,
      projected,
      message: `保证金占用超限：当前 ${(account.marginUtilizationRate * 100).toFixed(1)}%，加仓后 ${(projected * 100).toFixed(1)}%（阈值 ${(params.maxMarginUtilization * 100).toFixed(0)}%）`,
    };
  }

  return {
    ok: true,
    current: account.marginUtilizationRate,
    projected,
    message: "",
  };
}

// ─── Category concentration check ─────────────────────────────────────────────

export interface ConcentrationCheck {
  ok: boolean;
  category: AlertCategory;
  current: number;      // current category as % of total margin
  projected: number;   // projected % after this trade
  message: string;
}

export function checkConcentration(
  proposedMargin: number,
  category: AlertCategory,
  positions: PositionGroup[],
  account: AccountSnapshot,
  params: RiskParameters
): ConcentrationCheck {
  const netValue = account.netValue;
  const totalMargin = account.netValue * account.marginUtilizationRate + proposedMargin;

  // Sum existing margin per category
  const categoryMargin: Partial<Record<AlertCategory, number>> = {};
  for (const pos of positions) {
    if (pos.status !== "open") continue;
    for (const leg of pos.legs) {
      const cat = inferCategory(leg.asset);
      categoryMargin[cat] = (categoryMargin[cat] ?? 0) + leg.marginUsed;
    }
  }

  const currentCatMargin = categoryMargin[category] ?? 0;
  const projectedCatMargin = currentCatMargin + proposedMargin;

  const current = totalMargin > 0 ? currentCatMargin / totalMargin : 0;
  const projected = totalMargin > 0 ? projectedCatMargin / totalMargin : 0;

  if (projected > params.maxConcentrationPerCategory) {
    return {
      ok: false,
      category,
      current,
      projected,
      message: `品类集中度超限：${category} 品类保证金当前占总保证金 ${(current * 100).toFixed(1)}%，加仓后 ${(projected * 100).toFixed(1)}%（阈值 ${(params.maxConcentrationPerCategory * 100).toFixed(0)}%）`,
    };
  }

  return {
    ok: true,
    category,
    current,
    projected,
    message: "",
  };
}

// ─── Commodity lot count check ───────────────────────────────────────────────

export interface LotCountCheck {
  ok: boolean;
  asset: string;
  current: number;
  proposed: number;
  message: string;
}

export function checkLotCount(
  asset: string,
  proposedSize: number,
  positions: PositionGroup[],
  params: RiskParameters
): LotCountCheck {
  let currentLots = 0;
  for (const pos of positions) {
    if (pos.status !== "open") continue;
    for (const leg of pos.legs) {
      if (leg.asset === asset) {
        currentLots += leg.size;
      }
    }
  }

  const projected = currentLots + proposedSize;
  if (projected > params.maxPositionSizePerCommodity) {
    return {
      ok: false,
      asset,
      current: currentLots,
      proposed: proposedSize,
      message: `${asset} 仓位超限：当前 ${currentLots} 手，追加 ${proposedSize} 手，共 ${projected} 手（阈值 ${params.maxPositionSizePerCommodity} 手）`,
    };
  }

  return {
    ok: true,
    asset,
    current: currentLots,
    proposed: proposedSize,
    message: "",
  };
}

// ─── Composite position filter ───────────────────────────────────────────────

export interface PositionFilterResult {
  /** Risk warnings / violations found */
  riskItems: string[];
  /** True if any filter blocked or heavily warned the trigger */
  blocked: boolean;
  /** Individual check results for debugging */
  conflicts: DirectionConflict[];
  marginCheck: MarginCheck | null;
  concentrationChecks: ConcentrationCheck[];
  lotCountChecks: LotCountCheck[];
  /** Details on each failing check */
  details: string[];
}

/**
 * Apply all position-aware filters to a proposed trigger.
 * Used by trigger evaluators and alert creation routes.
 */
export function applyPositionFilters(
  legs: Array<{ asset: string; direction: Direction; size: number; marginEstimate?: number }>,
  category: AlertCategory,
  context: TriggerContext
): PositionFilterResult {
  const params = mergeRiskParams(context.riskParams);
  const positions = context.positions ?? [];
  const account = context.accountSnapshot;

  const result: PositionFilterResult = {
    riskItems: [],
    blocked: false,
    conflicts: [],
    marginCheck: null,
    concentrationChecks: [],
    lotCountChecks: [],
    details: [],
  };

  // 1. Direction conflicts
  result.conflicts = detectDirectionConflicts(legs, positions);
  for (const c of result.conflicts) {
    result.riskItems.push(c.message);
    result.details.push(c.message);
    // Direction conflicts are warnings, not hard blocks (could be a hedge)
    result.blocked = true; // but we flag it as significant
  }

  // 2. Margin utilization
  if (account) {
    const totalProposedMargin = legs.reduce(
      (sum, l) => sum + (l.marginEstimate ?? 0),
      0
    );
    if (totalProposedMargin > 0) {
      result.marginCheck = checkMarginUtilization(totalProposedMargin, account, params);
      if (!result.marginCheck.ok) {
        result.riskItems.push(result.marginCheck.message);
        result.details.push(result.marginCheck.message);
        result.blocked = true;
      }
    }

    // 3. Category concentration
    const totalProposedMargin2 = legs.reduce(
      (sum, l) => sum + (l.marginEstimate ?? 0),
      0
    );
    if (totalProposedMargin2 > 0) {
      const concCheck = checkConcentration(totalProposedMargin2, category, positions, account, params);
      result.concentrationChecks.push(concCheck);
      if (!concCheck.ok) {
        result.riskItems.push(concCheck.message);
        result.details.push(concCheck.message);
        result.blocked = true;
      }
    }
  }

  // 4. Per-commodity lot count
  for (const leg of legs) {
    const lotCheck = checkLotCount(leg.asset, leg.size, positions, params);
    result.lotCountChecks.push(lotCheck);
    if (!lotCheck.ok) {
      result.riskItems.push(lotCheck.message);
      result.details.push(lotCheck.message);
      result.blocked = true;
    }
  }

  return result;
}
