/**
 * Mock sector assessments for development / NEXT_PUBLIC_USE_MOCK_DATA=true.
 */
import type { SectorAssessment, FactorResult } from "@/types/domain";

const f = (name: string, dir: 1 | 0 | -1, str: number, dq: number, tf: "monthly" | "weekly" | "daily", desc: string): FactorResult => ({
  name, direction: dir, strength: str, dataQuality: dq, timeframe: tf, description: desc,
});

export const mockSectorAssessments: SectorAssessment[] = [
  // ── Ferrous ──
  {
    sectorId: "ferrous", symbol: "RB",
    conviction: {
      overallDirection: -1, score: 0.72,
      supportingFactors: [
        f("margin", -1, 0.8, 1, "daily", "钢厂利润: -150元/吨 (-8.2%) 亏损"),
        f("inventory", -1, 0.6, 1, "weekly", "RB库存: 520万吨 (季节性偏差+18.5%, 累库)"),
        f("seasonal", -1, 0.6, 1, "monthly", "RB: 7月处于淡季 — 建筑旺季3-5月/9-11月"),
      ],
      opposingFactors: [
        f("cost", 1, 0.4, 0.8, "daily", "螺纹钢生产成本: 盘面接近成本线 (成本3680, 盘面3720, 1.1%)"),
      ],
      dataGaps: [],
    },
    costFloor: 3680, productionMargin: -150, inventoryDeviation: 0.185, seasonalFactor: -0.6,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "ferrous", symbol: "HC",
    conviction: {
      overallDirection: -1, score: 0.58,
      supportingFactors: [
        f("margin", -1, 0.6, 1, "daily", "热卷利润: -80元/吨 (-4.5%) 亏损"),
        f("seasonal", -1, 0.6, 1, "monthly", "HC: 7月处于淡季"),
      ],
      opposingFactors: [],
      dataGaps: ["HC库存: 无库存数据"],
    },
    costFloor: 3750, productionMargin: -80, seasonalFactor: -0.6,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "ferrous", symbol: "I",
    conviction: {
      overallDirection: -1, score: 0.45,
      supportingFactors: [
        f("inventory", -1, 0.5, 0.6, "weekly", "I库存: 1.35亿吨 (季节性偏差+12.0%, 累库)"),
      ],
      opposingFactors: [
        f("seasonal", 1, 0.2, 1, "monthly", "I: 过渡期"),
      ],
      dataGaps: [],
    },
    inventoryDeviation: 0.12, seasonalFactor: 0,
    computedAt: new Date().toISOString(),
  },
  // ── Energy ──
  {
    sectorId: "energy", symbol: "SC",
    conviction: {
      overallDirection: 0, score: 0.25,
      supportingFactors: [],
      opposingFactors: [],
      dataGaps: ["SC库存: 无库存数据"],
    },
    seasonalFactor: 0,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "energy", symbol: "TA",
    conviction: {
      overallDirection: -1, score: 0.52,
      supportingFactors: [
        f("margin", -1, 0.5, 1, "daily", "聚酯利润: 偏高 (利润率22%)"),
        f("cost", -1, 0.3, 0.8, "daily", "PTA成本: 盘面高于成本线8.2%"),
      ],
      opposingFactors: [
        f("seasonal", 1, 0.6, 1, "monthly", "TA: 8月纺织旺季临近"),
      ],
      dataGaps: [],
    },
    costFloor: 5200, productionMargin: 350, seasonalFactor: 0.6,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "energy", symbol: "PP",
    conviction: {
      overallDirection: 0, score: 0.18,
      supportingFactors: [],
      opposingFactors: [],
      dataGaps: ["PP库存: 无库存数据"],
    },
    computedAt: new Date().toISOString(),
  },
  // ── Agriculture ──
  {
    sectorId: "agriculture", symbol: "P",
    conviction: {
      overallDirection: 1, score: 0.65,
      supportingFactors: [
        f("seasonal", 1, 0.8, 1, "monthly", "P: 处于旺季 — 棕榈油产量低季2-4月"),
        f("inventory", 1, 0.5, 0.6, "weekly", "P库存: 偏低 (季节性偏差-15.2%, 去库)"),
      ],
      opposingFactors: [
        f("substitute", -1, 0.2, 1, "daily", "棕榈油↔豆油: 价差580 (阈值800, 73%)"),
      ],
      dataGaps: [],
    },
    inventoryDeviation: -0.152, seasonalFactor: 0.8,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "agriculture", symbol: "M",
    conviction: {
      overallDirection: 1, score: 0.48,
      supportingFactors: [
        f("seasonal", 1, 0.6, 1, "monthly", "M: 9月大豆到港季前 — 需求旺季"),
      ],
      opposingFactors: [],
      dataGaps: ["M库存: 无库存数据"],
    },
    seasonalFactor: 0.6,
    computedAt: new Date().toISOString(),
  },
  {
    sectorId: "agriculture", symbol: "CF",
    conviction: {
      overallDirection: 0, score: 0.22,
      supportingFactors: [],
      opposingFactors: [],
      dataGaps: [],
    },
    computedAt: new Date().toISOString(),
  },
];
