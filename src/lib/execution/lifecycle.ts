/**
 * Position lifecycle operations: partial close, roll, add-to-position.
 */

import type { PositionGroup, ExecutionDraft, Direction } from "@/types/domain";

export interface PartialCloseRequest {
  positionId: string;
  legIndex: number;
  closeSize: number;
  reason?: string;
}

export interface RollRequest {
  positionId: string;
  fromContract: string;
  toContract: string;
  size: number;
  reason?: string;
}

export interface AddToPositionRequest {
  positionId: string;
  legIndex: number;
  addSize: number;
  reason?: string;
}

/**
 * Generate an execution draft for partial close.
 */
export function buildPartialCloseDraft(
  position: PositionGroup,
  req: PartialCloseRequest
): Omit<ExecutionDraft, "id" | "createdAt" | "updatedAt"> {
  const leg = position.legs[req.legIndex];
  if (!leg) throw new Error(`Leg index ${req.legIndex} not found`);
  if (req.closeSize > leg.size) throw new Error("Close size exceeds position size");

  const oppositeDir: Direction = leg.direction === "long" ? "short" : "long";

  return {
    recommendationId: position.recommendationId ?? "",
    status: "draft",
    legs: [
      {
        asset: leg.asset,
        direction: oppositeDir,
        type: "close",
        requestedSize: req.closeSize,
        unit: leg.unit,
        legStatus: "pending",
      },
    ],
    totalMarginUsed: 0,
    totalCommission: 0,
    notes: req.reason ?? `Partial close ${req.closeSize} ${leg.unit} of ${leg.asset}`,
  };
}

/**
 * Generate execution drafts for rolling a position (close old + open new contract).
 */
export function buildRollDrafts(
  position: PositionGroup,
  req: RollRequest
): Omit<ExecutionDraft, "id" | "createdAt" | "updatedAt"> {
  const leg = position.legs.find((l) => l.asset === req.fromContract);
  if (!leg) throw new Error(`Contract ${req.fromContract} not found in position`);

  const oppositeDir: Direction = leg.direction === "long" ? "short" : "long";

  return {
    recommendationId: position.recommendationId ?? "",
    status: "draft",
    legs: [
      {
        asset: req.fromContract,
        direction: oppositeDir,
        type: "close",
        requestedSize: req.size,
        unit: leg.unit,
        legStatus: "pending",
      },
      {
        asset: req.toContract,
        direction: leg.direction,
        type: "open",
        requestedSize: req.size,
        unit: leg.unit,
        legStatus: "pending",
      },
    ],
    totalMarginUsed: 0,
    totalCommission: 0,
    notes: req.reason ?? `Roll ${req.fromContract} → ${req.toContract} (${req.size} ${leg.unit})`,
  };
}
