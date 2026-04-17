import {
  calcPriorityScore,
  calcPortfolioFitScore,
  calcMarginEfficiencyScore,
  calcCombinedScore,
} from "@/lib/scoring";
import type { SpreadInfo, RecommendationLeg, PositionGroup } from "@/types/domain";

describe("calcPriorityScore", () => {
  it("returns base + confidence when no spreadInfo", () => {
    // base=30, confidence=0.8 → 30 + 0.8*15 = 42
    expect(calcPriorityScore(undefined, 0.8)).toBe(42);
  });

  it("adds z-score magnitude bonus", () => {
    const spread: SpreadInfo = {
      leg1: "RB2501", leg2: "RB2505",
      currentSpread: 100, historicalMean: 50,
      sigma1Upper: 80, sigma1Lower: 20,
      zScore: 2.5, halfLife: 30, adfPValue: 0.5, unit: "元/吨",
    };
    // base=30, zMag=2.5→min(30,25)=25, halfLife=(30-30)/30*15=0, adf>0.1→0, conf=0*15=0
    expect(calcPriorityScore(spread, 0)).toBe(55);
  });

  it("adds ADF bonus when pValue < 0.05", () => {
    const spread: SpreadInfo = {
      leg1: "A", leg2: "B",
      currentSpread: 0, historicalMean: 0,
      sigma1Upper: 0, sigma1Lower: 0,
      zScore: 0, halfLife: 30, adfPValue: 0.03, unit: "",
    };
    // base=30, zMag=0, halfLife=0, adf<0.05→+10, conf=0
    expect(calcPriorityScore(spread, 0)).toBe(40);
  });

  it("clamps to 100 max", () => {
    const spread: SpreadInfo = {
      leg1: "A", leg2: "B",
      currentSpread: 0, historicalMean: 0,
      sigma1Upper: 0, sigma1Lower: 0,
      zScore: 10, halfLife: 0, adfPValue: 0.01, unit: "",
    };
    // base=30, zMag=min(30,100)=30, halfLife=(30-0)/30*15=15, adf=10, conf=1*15=15 → 100 clamped
    expect(calcPriorityScore(spread, 1)).toBe(100);
  });
});

describe("calcPortfolioFitScore", () => {
  it("returns 75 for empty positions", async () => {
    const legs: RecommendationLeg[] = [
      { asset: "RB2501", direction: "long", suggestedSize: 10, unit: "手" },
    ];
    expect(await calcPortfolioFitScore(legs, [])).toBe(75);
  });

  it("penalizes asset overlap", async () => {
    const legs: RecommendationLeg[] = [
      { asset: "RB2501", direction: "long", suggestedSize: 10, unit: "手" },
    ];
    const positions: PositionGroup[] = [{
      id: "p1", status: "open",
      legs: [{ asset: "RB2501", direction: "short", size: 5, unit: "手", entryPrice: 3800, currentPrice: 3900, unrealizedPnl: 500, marginUsed: 10000 }],
      strategyName: "test", openedAt: "", entrySpread: 0, currentSpread: 0,
      spreadUnit: "", unrealizedPnl: 0, totalMarginUsed: 0, exitCondition: "",
      targetZScore: 0, currentZScore: 0, halfLifeDays: 0, daysHeld: 0,
    }];
    const score = await calcPortfolioFitScore(legs, positions);
    // base=70, overlap=1 → penalty=20, diversification=5 → 70-20+5=55
    expect(score).toBe(55);
  });
});

describe("calcMarginEfficiencyScore", () => {
  it("returns 50 when accountNetValue <= 0", () => {
    expect(calcMarginEfficiencyScore([], 1000, 0)).toBe(50);
  });

  it("scores high for low margin ratio", () => {
    // marginRatio = 5000/100000 = 0.05, score = 100 - 0.05*200 = 90
    expect(calcMarginEfficiencyScore([], 5000, 100000)).toBe(90);
  });
});

describe("calcCombinedScore", () => {
  it("applies correct weights", () => {
    // 0.4*80 + 0.3*60 + 0.3*40 = 32+18+12 = 62
    expect(calcCombinedScore(80, 60, 40)).toBe(62);
  });
});
