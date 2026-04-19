import { NextRequest, NextResponse } from "next/server";

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";

/**
 * POST /api/backtest — run a backtest with AkShare data
 * Body: { strategy, sym1, sym2, entryZ, exitZ, window }
 */
export async function POST(request: NextRequest) {
  try {
    const { strategy, sym1, sym2, entryZ = 2.0, exitZ = 0.5, window = 60 } = await request.json();

    // 1. Fetch market data from AkShare endpoints
    const [res1, res2] = await Promise.all([
      fetch(`${BACKTEST_URL}/market-data/${sym1}?days=500`, { signal: AbortSignal.timeout(30000) }),
      fetch(`${BACKTEST_URL}/market-data/${sym2}?days=500`, { signal: AbortSignal.timeout(30000) }),
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

    // 3. Send to backtest engine
    const btRes = await fetch(`${BACKTEST_URL}/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hypothesis_id: `${strategy}_${sym1}_${sym2}`,
        legs: [
          { asset: sym1, direction: "long", ratio: 1.0 },
          { asset: sym2, direction: "short", ratio: 1.0 },
        ],
        prices,
        dates,
        entry_threshold: entryZ,
        exit_threshold: exitZ,
        window,
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
