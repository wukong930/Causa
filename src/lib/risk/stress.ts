import type { PositionGroup } from "@/types/domain";

export interface StressScenario {
  name: string;
  description: string;
  shocks: Record<string, number>; // symbol prefix → % change
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
        const legPnl = leg.currentPrice * leg.size * shock * (leg.direction === "long" ? 1 : -1);
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
