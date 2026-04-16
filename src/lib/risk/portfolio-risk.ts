import type { PositionGroup, MarketDataPoint, AccountSnapshot } from "@/types/domain";
import { calculateVaR, type VaRResult } from "./var";
import { runStressTest, type StressTestResult } from "./stress";
import { buildCorrelationMatrix, type CorrelationMatrix } from "./correlation";

export interface PortfolioRiskReport {
  var: VaRResult;
  stressTests: StressTestResult[];
  correlation: CorrelationMatrix;
  concentrationRisk: ConcentrationRisk;
  summary: RiskSummary;
}

export interface ConcentrationRisk {
  byCategory: Record<string, number>;   // category → % of total margin
  byCommodity: Record<string, number>;  // symbol prefix → % of total margin
  maxSinglePosition: number;            // % of total margin
  herfindahlIndex: number;              // 0–1, higher = more concentrated
}

export interface RiskSummary {
  overallLevel: "low" | "medium" | "high" | "critical";
  var95PctOfNav: number;   // VaR95 as % of NAV
  maxStressLoss: number;   // worst scenario P&L
  maxStressLossPctOfNav: number;
  highCorrelationPairs: Array<{ sym1: string; sym2: string; corr: number }>;
}

function getSymbolPrefix(symbol: string): string {
  return symbol.replace(/\d+/, "");
}

function computeConcentration(
  positions: PositionGroup[],
  totalMargin: number
): ConcentrationRisk {
  const byCategory: Record<string, number> = {};
  const byCommodity: Record<string, number> = {};

  for (const pos of positions) {
    if (pos.status !== "open") continue;
    for (const leg of pos.legs) {
      const prefix = getSymbolPrefix(leg.asset);
      byCommodity[prefix] = (byCommodity[prefix] ?? 0) + leg.marginUsed;
    }
  }

  // Normalize to percentages
  if (totalMargin > 0) {
    for (const key of Object.keys(byCommodity)) {
      byCommodity[key] = Math.round((byCommodity[key] / totalMargin) * 1000) / 10;
    }
  }

  // Herfindahl index
  const shares = Object.values(byCommodity).map((v) => v / 100);
  const hhi = shares.reduce((s, v) => s + v * v, 0);

  const maxSingle = Math.max(...Object.values(byCommodity), 0);

  return { byCategory, byCommodity, maxSinglePosition: maxSingle, herfindahlIndex: Math.round(hhi * 1000) / 1000 };
}

/**
 * Build a comprehensive portfolio risk report.
 */
export function buildPortfolioRiskReport(
  positions: PositionGroup[],
  marketDataBySymbol: Record<string, MarketDataPoint[]>,
  account: AccountSnapshot
): PortfolioRiskReport {
  const openPositions = positions.filter((p) => p.status === "open");

  // VaR
  const varResult = calculateVaR(openPositions, marketDataBySymbol);

  // Stress tests
  const stressResults = runStressTest(openPositions);

  // Correlation
  const symbols = [...new Set(openPositions.flatMap((p) => p.legs.map((l) => l.asset)))];
  const corrMatrix = buildCorrelationMatrix(marketDataBySymbol, symbols);

  // Concentration
  const totalMargin = account.netValue - account.availableMargin;
  const concentration = computeConcentration(openPositions, totalMargin);

  // Summary
  const nav = account.netValue;
  const var95Pct = nav > 0 ? Math.round((varResult.var95 / nav) * 1000) / 10 : 0;
  const worstStress = Math.min(...stressResults.map((s) => s.portfolioPnl), 0);
  const worstStressPct = nav > 0 ? Math.round((worstStress / nav) * 1000) / 10 : 0;

  // High correlation pairs (|corr| > 0.7)
  const highCorrPairs: RiskSummary["highCorrelationPairs"] = [];
  for (let i = 0; i < corrMatrix.symbols.length; i++) {
    for (let j = i + 1; j < corrMatrix.symbols.length; j++) {
      const c = corrMatrix.matrix[i][j];
      if (Math.abs(c) > 0.7) {
        highCorrPairs.push({ sym1: corrMatrix.symbols[i], sym2: corrMatrix.symbols[j], corr: c });
      }
    }
  }

  const overallLevel: RiskSummary["overallLevel"] =
    var95Pct > 5 || Math.abs(worstStressPct) > 15 ? "critical" :
    var95Pct > 3 || Math.abs(worstStressPct) > 10 ? "high" :
    var95Pct > 1.5 || Math.abs(worstStressPct) > 5 ? "medium" : "low";

  return {
    var: varResult,
    stressTests: stressResults,
    correlation: corrMatrix,
    concentrationRisk: concentration,
    summary: {
      overallLevel,
      var95PctOfNav: var95Pct,
      maxStressLoss: worstStress,
      maxStressLossPctOfNav: worstStressPct,
      highCorrelationPairs: highCorrPairs,
    },
  };
}
