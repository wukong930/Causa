import type { PositionGroup, MarketDataPoint } from "@/types/domain";

export interface StressScenario {
  name: string;
  description: string;
  shocks: Record<string, number>; // symbol prefix → % change
  historical?: boolean; // derived from actual market data
}

export interface StressTestResult {
  scenario: string;
  description: string;
  portfolioPnl: number;
  positionImpacts: Array<{
    positionId: string;
    strategyName: string;
    pnl: number;
  }>;
}

/** Predefined stress scenarios */
export const STRESS_SCENARIOS: StressScenario[] = [
  {
    name: "商品暴跌",
    description: "所有商品价格下跌 20%",
    shocks: { RB: -0.20, HC: -0.20, I: -0.20, CU: -0.20, AL: -0.20, SC: -0.20, NI: -0.20, ZN: -0.20 },
  },
  {
    name: "黑色系崩盘",
    description: "黑色系品种下跌 25%，有色下跌 10%",
    shocks: { RB: -0.25, HC: -0.25, I: -0.25, J: -0.25, JM: -0.25, CU: -0.10, AL: -0.10, NI: -0.10 },
  },
  {
    name: "美元飙升",
    description: "美元走强导致有色金属下跌 15%，黑色系下跌 5%",
    shocks: { CU: -0.15, AL: -0.15, NI: -0.15, ZN: -0.15, AU: -0.10, AG: -0.12, RB: -0.05, HC: -0.05 },
  },
  {
    name: "流动性冻结",
    description: "所有品种下跌 10%，模拟流动性危机",
    shocks: { RB: -0.10, HC: -0.10, I: -0.10, CU: -0.10, AL: -0.10, SC: -0.10, NI: -0.10, ZN: -0.10 },
  },
  {
    name: "通胀飙升",
    description: "能源+农产品上涨 15%，金属下跌 5%",
    shocks: { SC: 0.15, FU: 0.15, CU: -0.05, AL: -0.05, RB: 0.05, HC: 0.05 },
  },
  // Historical scenarios
  {
    name: "2022 黑色系限产",
    description: "限产政策导致螺纹钢暴涨，铁矿石暴跌",
    shocks: { RB: 0.15, HC: 0.12, I: -0.25, J: -0.20, JM: -0.18, CU: -0.03, AL: -0.02 },
    historical: true,
  },
  {
    name: "2020 原油负价格",
    description: "原油暴跌，能化链全面崩溃",
    shocks: { SC: -0.40, FU: -0.35, TA: -0.20, EG: -0.18, RB: -0.05, CU: -0.08 },
    historical: true,
  },
  {
    name: "2023 硅铁锰硅暴涨",
    description: "合金品种供给收缩导致暴涨",
    shocks: { SF: 0.30, SM: 0.25, RB: 0.05, HC: 0.05, I: 0.03 },
    historical: true,
  },
];

function getSymbolPrefix(symbol: string): string {
  return symbol.replace(/\d+/, "");
}

/**
 * Run stress tests on current positions.
 */
export function runStressTest(
  positions: PositionGroup[],
  scenarios?: StressScenario[]
): StressTestResult[] {
  const scenariosToRun = scenarios ?? STRESS_SCENARIOS;
  const results: StressTestResult[] = [];

  for (const scenario of scenariosToRun) {
    let portfolioPnl = 0;
    const positionImpacts: StressTestResult["positionImpacts"] = [];

    for (const pos of positions) {
      if (pos.status !== "open") continue;

      let posPnl = 0;
      for (const leg of pos.legs) {
        const prefix = getSymbolPrefix(leg.asset);
        const shock = scenario.shocks[prefix] ?? 0;
        const price = leg.currentPrice ?? 0;
        const size = leg.size ?? 0;
        const legPnl = price * size * shock * (leg.direction === "long" ? 1 : -1);
        posPnl += legPnl;
      }

      portfolioPnl += posPnl;
      positionImpacts.push({
        positionId: pos.id,
        strategyName: pos.strategyName ?? pos.id,
        pnl: Math.round(posPnl),
      });
    }

    results.push({
      scenario: scenario.name,
      description: scenario.description,
      portfolioPnl: Math.round(portfolioPnl),
      positionImpacts,
    });
  }

  return results;
}

/**
 * Extract historical extreme days from market data and create stress scenarios.
 * Finds days where any symbol had returns < -3σ, then uses actual cross-asset
 * returns on that day as the shock vector.
 */
export function extractHistoricalExtremes(
  marketDataBySymbol: Record<string, MarketDataPoint[]>,
  maxScenarios: number = 5
): StressScenario[] {
  // Compute daily returns per symbol
  const returnsBySymbol: Record<string, Array<{ date: string; ret: number }>> = {};

  for (const [symbol, data] of Object.entries(marketDataBySymbol)) {
    if (data.length < 20) continue;
    const sorted = [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const returns: Array<{ date: string; ret: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].close === 0) continue;
      returns.push({
        date: sorted[i].timestamp,
        ret: (sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close,
      });
    }
    returnsBySymbol[symbol] = returns;
  }

  // Find extreme days (any symbol with |return| > 3σ)
  const extremeDays: Array<{ date: string; symbol: string; ret: number; sigma: number }> = [];

  for (const [symbol, returns] of Object.entries(returnsBySymbol)) {
    if (returns.length < 20) continue;
    const rets = returns.map((r) => r.ret);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length);
    if (std === 0) continue;

    for (const r of returns) {
      const z = Math.abs((r.ret - mean) / std);
      if (z > 3) {
        extremeDays.push({ date: r.date, symbol, ret: r.ret, sigma: z });
      }
    }
  }

  // Sort by severity and deduplicate by date
  extremeDays.sort((a, b) => b.sigma - a.sigma);
  const seenDates = new Set<string>();
  const scenarios: StressScenario[] = [];

  for (const extreme of extremeDays) {
    if (seenDates.has(extreme.date) || scenarios.length >= maxScenarios) continue;
    seenDates.add(extreme.date);

    // Compute empirical tail correlation boost from this extreme day
    // Compare average |return| on extreme days vs normal days for co-movement amplification
    const dayReturns: number[] = [];
    const normalReturns: number[] = [];
    for (const [, returns] of Object.entries(returnsBySymbol)) {
      const dayReturn = returns.find((r) => r.date === extreme.date);
      if (dayReturn) dayReturns.push(Math.abs(dayReturn.ret));
      const mean = returns.reduce((a, r) => a + Math.abs(r.ret), 0) / returns.length;
      normalReturns.push(mean);
    }
    const avgExtremeRet = dayReturns.length > 0 ? dayReturns.reduce((a, b) => a + b, 0) / dayReturns.length : 0;
    const avgNormalRet = normalReturns.length > 0 ? normalReturns.reduce((a, b) => a + b, 0) / normalReturns.length : 0;
    const tailBoost = avgNormalRet > 0 && dayReturns.length >= 5
      ? Math.min(2.0, Math.max(1.0, avgExtremeRet / avgNormalRet))
      : 1.3; // fallback

    // Collect all symbol returns on this date
    const shocks: Record<string, number> = {};
    for (const [symbol, returns] of Object.entries(returnsBySymbol)) {
      const dayReturn = returns.find((r) => r.date === extreme.date);
      if (dayReturn) {
        const prefix = symbol.replace(/\d+/, "");
        const tailAdjusted = dayReturn.ret * (Math.abs(dayReturn.ret) > 0.03 ? tailBoost : 1.0);
        shocks[prefix] = Math.round(tailAdjusted * 1000) / 1000;
      }
    }

    scenarios.push({
      name: `历史极端日 ${extreme.date.slice(0, 10)}`,
      description: `${extreme.symbol} 偏离 ${extreme.sigma.toFixed(1)}σ，尾部相关性调整`,
      shocks,
      historical: true,
    });
  }

  return scenarios;
}
