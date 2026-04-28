import type { SectorConfig } from "./types";

/**
 * 黑色板块 (Ferrous Metals)
 *
 * 产业链: 铁矿石(I) + 焦炭(J) → 生铁 → 螺纹钢(RB)/热卷(HC)
 * 焦煤(JM) → 焦炭(J)
 * 硅铁(SF)/锰硅(SM) → 合金添加剂
 */
export const ferrousSector: SectorConfig = {
  id: "ferrous",
  name: "黑色",
  symbols: ["RB", "HC", "SS", "I", "J", "JM", "SF", "SM"],

  costFormulas: {
    RB: {
      label: "螺纹钢生产成本",
      inputs: [
        { symbol: "I", weight: 1.6, label: "铁矿石" },
        { symbol: "J", weight: 0.5, label: "焦炭" },
      ],
      fees: 800,
    },
    HC: {
      label: "热卷生产成本",
      inputs: [
        { symbol: "I", weight: 1.6, label: "铁矿石" },
        { symbol: "J", weight: 0.5, label: "焦炭" },
      ],
      fees: 900,
    },
    J: {
      label: "焦炭生产成本",
      inputs: [{ symbol: "JM", weight: 1.3, label: "焦煤" }],
      fees: 200,
    },
  },

  marginFormulas: {
    RB: {
      label: "钢厂利润(螺纹)",
      product: { symbol: "RB", coefficient: 1.0 },
      rawMaterials: [
        { symbol: "I", coefficient: 1.6 },
        { symbol: "J", coefficient: 0.5 },
      ],
      processingCost: 800,
    },
    HC: {
      label: "钢厂利润(热卷)",
      product: { symbol: "HC", coefficient: 1.0 },
      rawMaterials: [
        { symbol: "I", coefficient: 1.6 },
        { symbol: "J", coefficient: 0.5 },
      ],
      processingCost: 900,
    },
  },

  seasonalPatterns: [
    { symbol: "RB", peakMonths: [3, 4, 5, 9, 10, 11], troughMonths: [1, 2, 7, 8], description: "建筑旺季3-5月/9-11月，冬季+高温淡季" },
    { symbol: "HC", peakMonths: [3, 4, 5, 9, 10, 11], troughMonths: [1, 2, 7, 8], description: "制造业旺季与螺纹同步" },
    { symbol: "I", peakMonths: [3, 4, 9, 10], troughMonths: [6, 7, 12, 1], description: "钢厂补库驱动，跟随成材需求" },
    { symbol: "J", peakMonths: [3, 4, 9, 10], troughMonths: [6, 7, 8], description: "焦化利润驱动，夏季环保限产" },
  ],

  substitutePairs: [
    { symbolA: "RB", symbolB: "HC", threshold: 200, direction: "positive", label: "螺纹-热卷替代(卷螺差)" },
    { symbolA: "SF", symbolB: "SM", threshold: 1500, direction: "positive", label: "硅铁-锰硅替代" },
  ],

  factorWeights: {
    cost:       { weight: 0.20, timeframe: "daily" },
    margin:     { weight: 0.25, timeframe: "daily" },
    inventory:  { weight: 0.25, timeframe: "weekly" },
    seasonal:   { weight: 0.15, timeframe: "monthly" },
    substitute: { weight: 0.15, timeframe: "daily" },
  },
};
