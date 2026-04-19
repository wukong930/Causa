import { NextRequest, NextResponse } from "next/server";

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";

/**
 * POST /api/backtest — run a backtest with AkShare data
 * Body: { strategy, sym1, sym2, entryZ, exitZ, window, strategy_type, strategy_params, action }
 * action: "backtest" (default) | "optimize" | "walk-forward"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, sym1, sym2, entryZ = 2.0, exitZ = 0.5, window = 60,
            strategy_type, strategy_params, action = "backtest" } = body;

    // 1. Fetch market data from AkShare endpoints
    const [res1, res2] = await Promise.all([
      fetch(`${BACKTEST_URL}/market-data/${sym1}?days=750`, { signal: AbortSignal.timeout(30000) }),
      fetch(`${BACKTEST_URL}/market-data/${sym2}?days=750`, { signal: AbortSignal.timeout(30000) }),
    ]);

    if (!res1.ok || !res2.ok) {
      return NextResponse.json({ success: false, error: "无法获取行情数据" }, { status: 502 });
    }

    const bars1: { date: string; close: number }[] = await res1.json();
    const bars2: { date: string; close: number }[] = await res2.json();

    // 2. Align dates
    const dateSet2 = new Set(bars2.map((b) => b.date));
    const aligned1 = bars1.filter((b) => dateSet2.has(b.date));
    const dateSet1 = new Set(aligned1.map((b) => b.date));
    const aligned2 = bars2.filter((b) => dateSet1.has(b.date));

    const dates = aligned1.map((b) => b.date);
    const prices: Record<string, number[]> = {
      [sym1]: aligned1.map((b) => b.close),
      [sym2]: aligned2.map((b) => b.close),
    };

    const legs = [
      { asset: sym1, direction: "long", ratio: 1.0 },
      { asset: sym2, direction: "short", ratio: 1.0 },
    ];

    const resolvedStrategy = strategy_type || (strategy === "momentum" ? "momentum_breakout" : strategy === "spread_arbitrage" ? "mean_reversion" : strategy || "mean_reversion");

    // 3. Route by action
    if (action === "optimize") {
      const optRes = await fetch(`${BACKTEST_URL}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs, prices, dates, strategy_type: resolvedStrategy }),
        signal: AbortSignal.timeout(60000),
      });
      if (!optRes.ok) return NextResponse.json({ success: false, error: await optRes.text() }, { status: 502 });
      return NextResponse.json(await optRes.json());
    }

    if (action === "walk-forward") {
      const wfRes = await fetch(`${BACKTEST_URL}/walk-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs, prices, dates, strategy_type: resolvedStrategy,
          strategy_params: strategy_params || {},
          entry_threshold: entryZ, exit_threshold: exitZ, window, n_splits: 5,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!wfRes.ok) return NextResponse.json({ success: false, error: await wfRes.text() }, { status: 502 });
      return NextResponse.json(await wfRes.json());
    }

    // Default: run backtest
    const btRes = await fetch(`${BACKTEST_URL}/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hypothesis_id: `${resolvedStrategy}_${sym1}_${sym2}`,
        legs, prices, dates,
        entry_threshold: entryZ, exit_threshold: exitZ, window,
        strategy_type: resolvedStrategy,
        strategy_params: strategy_params || {},
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!btRes.ok) {
      const text = await btRes.text();
      return NextResponse.json({ success: false, error: text }, { status: 502 });
    }

    return NextResponse.json(await btRes.json());
  } catch (error) {
    console.error("POST /api/backtest error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "回测失败" },
      { status: 500 }
    );
  }
}
