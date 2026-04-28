/**
 * Signal Propagation Engine — traces impact through the commodity graph.
 *
 * When symbol X triggers a signal, propagate downstream:
 *   impact = strength × edge.influenceWeight × edge.propagationDirection
 *   calibrated by target's inventory deviation (high inventory absorbs shock)
 *
 * Supports 2-level recursive propagation with strength decay.
 * Cutoff at |impact| < 0.15.
 */

import type { RelationshipEdge, FactorDirection, SectorAssessment } from "@/types/domain";

export interface PropagationAlert {
  sourceSymbol: string;
  targetSymbol: string;
  expectedImpact: number;        // signed: positive = bullish for target
  impactDirection: FactorDirection;
  impactStrength: number;        // 0-1 absolute
  lagDays: number;
  path: string[];                // e.g. ["I", "RB"] or ["JM", "J", "RB"]
  description: string;
}

export interface PropagationInput {
  sourceSymbol: string;
  signalStrength: number;        // 0-1
  signalDirection: FactorDirection;
  edges: RelationshipEdge[];
  /** Sector assessments for inventory calibration */
  assessments?: Map<string, SectorAssessment>;
  /** Max propagation depth (default 2) */
  maxDepth?: number;
}

const IMPACT_CUTOFF = 0.15;
const DECAY_FACTOR = 0.6;

export function propagateSignal(input: PropagationInput): PropagationAlert[] {
  const {
    sourceSymbol,
    signalStrength,
    signalDirection,
    edges,
    assessments,
    maxDepth = 2,
  } = input;

  if (signalDirection === 0 || signalStrength < IMPACT_CUTOFF) return [];

  const alerts: PropagationAlert[] = [];
  const visited = new Set<string>([sourceSymbol]);

  function traverse(
    currentSymbol: string,
    currentStrength: number,
    currentDirection: FactorDirection,
    depth: number,
    path: string[],
  ) {
    if (depth > maxDepth) return;

    // Find downstream edges from current symbol
    const downstream = edges.filter(
      (e) =>
        e.source === currentSymbol &&
        e.influenceWeight != null &&
        e.propagationDirection != null &&
        !visited.has(e.target)
    );

    for (const edge of downstream) {
      const rawImpact =
        currentStrength *
        (edge.influenceWeight ?? 0) *
        (edge.propagationDirection ?? 1);

      // Inventory calibration: high inventory absorbs shock, low amplifies
      let calibrationFactor = 1.0;
      const targetAssessment = assessments?.get(edge.target);
      if (targetAssessment?.inventoryDeviation != null) {
        const inv = targetAssessment.inventoryDeviation;
        if (inv > 0.5) {
          calibrationFactor = 0.3;  // high inventory absorbs
        } else if (inv > 0.2) {
          calibrationFactor = 0.6;
        } else if (inv < -0.5) {
          calibrationFactor = 1.2;  // low inventory amplifies
        } else if (inv < -0.2) {
          calibrationFactor = 1.1;
        }
      }

      const calibratedImpact = rawImpact * calibrationFactor;
      const absImpact = Math.abs(calibratedImpact);

      if (absImpact < IMPACT_CUTOFF) continue;

      const impactDirection: FactorDirection =
        (currentDirection * (edge.propagationDirection ?? 1)) as FactorDirection;
      const targetPath = [...path, edge.target];

      alerts.push({
        sourceSymbol: input.sourceSymbol,
        targetSymbol: edge.target,
        expectedImpact: calibratedImpact * currentDirection,
        impactDirection,
        impactStrength: Math.min(1, absImpact),
        lagDays: (edge.lagDays ?? 1) + (depth > 1 ? path.length - 1 : 0),
        path: targetPath,
        description: buildDescription(
          input.sourceSymbol,
          edge.target,
          impactDirection,
          absImpact,
          edge.lagDays ?? 1,
          targetPath,
          calibrationFactor,
        ),
      });

      // Recursive propagation with decay
      visited.add(edge.target);
      traverse(
        edge.target,
        absImpact * DECAY_FACTOR,
        impactDirection,
        depth + 1,
        targetPath,
      );
    }
  }

  traverse(sourceSymbol, signalStrength, signalDirection, 1, [sourceSymbol]);

  // Sort by impact strength descending
  alerts.sort((a, b) => b.impactStrength - a.impactStrength);
  return alerts;
}

function buildDescription(
  source: string,
  target: string,
  direction: FactorDirection,
  strength: number,
  lagDays: number,
  path: string[],
  calibration: number,
): string {
  const dirLabel = direction === 1 ? "偏多" : direction === -1 ? "偏空" : "中性";
  const pathStr = path.join(" → ");
  const strengthPct = (strength * 100).toFixed(0);
  const calibLabel =
    calibration < 0.5 ? " (高库存衰减)" :
    calibration > 1.1 ? " (低库存放大)" : "";

  return `${pathStr}: ${dirLabel}${strengthPct}%, 预计${lagDays}日传导${calibLabel}`;
}
