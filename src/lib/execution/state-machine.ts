/**
 * Leg-level execution state machine (v3.1 spec).
 *
 * States: pending → confirmed → legging → active → exiting → closed
 *                                                            ↗
 *         any state ──────────────────────────────────→ broken
 */

import type { ExecutionLegStatus } from "@/types/domain";

export type LegEvent =
  | "confirm"       // exchange acknowledged
  | "partial_fill"  // partial fill received
  | "full_fill"     // fully filled
  | "start_exit"    // begin closing
  | "close"         // fully closed
  | "break";        // execution failure

const TRANSITIONS: Record<ExecutionLegStatus, Partial<Record<LegEvent, ExecutionLegStatus>>> = {
  pending: {
    confirm: "confirmed",
    break: "broken",
  },
  confirmed: {
    partial_fill: "legging",
    full_fill: "active",
    break: "broken",
  },
  legging: {
    partial_fill: "legging",
    full_fill: "active",
    break: "broken",
  },
  active: {
    start_exit: "exiting",
    break: "broken",
  },
  exiting: {
    partial_fill: "exiting",
    close: "closed",
    break: "broken",
  },
  closed: {},
  broken: {},
};

export function transition(
  current: ExecutionLegStatus,
  event: LegEvent
): ExecutionLegStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} + ${event}`);
  }
  return next;
}

export function canTransition(
  current: ExecutionLegStatus,
  event: LegEvent
): boolean {
  return TRANSITIONS[current]?.[event] !== undefined;
}

export function getAvailableEvents(current: ExecutionLegStatus): LegEvent[] {
  return Object.keys(TRANSITIONS[current] ?? {}) as LegEvent[];
}
