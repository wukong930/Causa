import { NextRequest, NextResponse } from "next/server";
import type { FactorDirection } from "@/types/domain";
import { propagateSignal, type PropagationAlert } from "@/lib/sector/propagation";
import { mockEdges } from "@/mocks/graph";

/**
 * GET /api/commodity-graph/propagation?symbol=I&direction=1&strength=0.7
 *
 * Simulates signal propagation from a source commodity through the graph.
 * Returns downstream impacts with expected timing and strength.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const direction = Number(searchParams.get("direction") ?? "1") as FactorDirection;
  const strength = Number(searchParams.get("strength") ?? "0.6");

  if (!symbol) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "symbol is required" } },
      { status: 400 },
    );
  }

  if (![1, 0, -1].includes(direction)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "direction must be 1, 0, or -1" } },
      { status: 400 },
    );
  }

  try {
    // TODO: when DB is live, query edges from DB instead of mocks
    const alerts = propagateSignal({
      sourceSymbol: symbol,
      signalStrength: Math.min(1, Math.max(0, strength)),
      signalDirection: direction,
      edges: mockEdges,
    });

    return NextResponse.json({
      success: true,
      data: {
        source: symbol,
        direction,
        strength,
        propagations: alerts,
        totalImpacted: alerts.length,
      },
    });
  } catch (error) {
    console.error("GET /api/commodity-graph/propagation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Propagation simulation failed" } },
      { status: 500 },
    );
  }
}
