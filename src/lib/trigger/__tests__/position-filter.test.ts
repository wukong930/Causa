import {
  detectDirectionConflicts,
  checkMarginUtilization,
  checkConcentration,
  checkLotCount,
} from "../position-filter";
import type { PositionGroup, AccountSnapshot } from "@/types/domain";
import type { RiskParameters } from "../base";

const mkPosition = (
  overrides: Partial<PositionGroup> & { legs: PositionGroup["legs"]; status: PositionGroup["status"] }
): PositionGroup =>
  ({
    id: "pos-1",
    strategyId: "s1",
    strategyName: "Test Strategy",
    legs: [],
    openedAt: "2024-01-01T00:00:00Z",
    entrySpread: 0,
    currentSpread: 0,
    spreadUnit: "元/吨",
    unrealizedPnl: 0,
    totalMarginUsed: 0,
    exitCondition: "",
    targetZScore: 0.5,
    currentZScore: 1.0,
    halfLifeDays: 10,
    daysHeld: 5,
    ...overrides,
  } as PositionGroup);

const mkLeg = (asset: string, direction: "long" | "short", extra?: Partial<PositionGroup["legs"][0]>) => ({
  asset,
  direction,
  size: 5,
  unit: "手",
  entryPrice: 4000,
  currentPrice: 4100,
  unrealizedPnl: 500,
  marginUsed: 20000,
  ...extra,
});

const defaultParams: RiskParameters = {
  maxPositionSizePerCommodity: 10,
  maxMarginUtilization: 0.8,
  maxConcentrationPerCategory: 0.4,
};

const defaultAccount: AccountSnapshot = {
  netValue: 1_000_000,
  availableMargin: 500_000,
  marginUtilizationRate: 0.3,
  totalUnrealizedPnl: 10_000,
  todayRealizedPnl: 0,
  snapshotAt: "2024-01-01T00:00:00Z",
};

describe("detectDirectionConflicts", () => {
  it("returns conflict when same asset has opposite direction", () => {
    const positions = [mkPosition({ status: "open", legs: [mkLeg("RB2501", "long")] })];
    const result = detectDirectionConflicts([{ asset: "RB2501", direction: "short" }], positions);
    expect(result).toHaveLength(1);
    expect(result[0].proposedDirection).toBe("short");
    expect(result[0].existingDirection).toBe("long");
  });

  it("returns no conflict when same direction", () => {
    const positions = [mkPosition({ status: "open", legs: [mkLeg("RB2501", "long")] })];
    const result = detectDirectionConflicts([{ asset: "RB2501", direction: "long" }], positions);
    expect(result).toHaveLength(0);
  });

  it("ignores closed positions", () => {
    const positions = [mkPosition({ status: "closed", legs: [mkLeg("RB2501", "long")] })];
    const result = detectDirectionConflicts([{ asset: "RB2501", direction: "short" }], positions);
    expect(result).toHaveLength(0);
  });
});

describe("checkMarginUtilization", () => {
  it("returns ok when projected utilization is under limit", () => {
    const result = checkMarginUtilization(50_000, defaultAccount, defaultParams);
    // current used = 1M * 0.3 = 300k, projected = 350k / 1M = 0.35 < 0.8
    expect(result.ok).toBe(true);
  });

  it("returns not ok when projected utilization exceeds limit", () => {
    const result = checkMarginUtilization(600_000, defaultAccount, defaultParams);
    // projected = (300k + 600k) / 1M = 0.9 > 0.8
    expect(result.ok).toBe(false);
    expect(result.projected).toBeCloseTo(0.9);
  });
});

describe("checkConcentration", () => {
  it("returns ok when category concentration is under limit", () => {
    const positions = [mkPosition({ status: "open", legs: [mkLeg("RB2501", "long", { marginUsed: 50_000 })] })];
    const result = checkConcentration(10_000, "ferrous", positions, defaultAccount, defaultParams);
    expect(result.ok).toBe(true);
  });
});

describe("checkLotCount", () => {
  it("returns ok when total lots are under limit", () => {
    const positions = [mkPosition({ status: "open", legs: [mkLeg("RB2501", "long", { size: 3 })] })];
    const result = checkLotCount("RB2501", 5, positions, defaultParams);
    // 3 + 5 = 8 <= 10
    expect(result.ok).toBe(true);
  });

  it("returns not ok when total lots exceed limit", () => {
    const positions = [mkPosition({ status: "open", legs: [mkLeg("RB2501", "long", { size: 7 })] })];
    const result = checkLotCount("RB2501", 5, positions, defaultParams);
    // 7 + 5 = 12 > 10
    expect(result.ok).toBe(false);
  });
});
