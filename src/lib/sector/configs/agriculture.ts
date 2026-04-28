import type { SectorConfig } from "./types";

/**
 * 农产品板块 (Agriculture)
 *
 * 油脂链: 大豆(A) → 豆油(Y) + 豆粕(M)  (压榨)
 *         棕榈油(P) ↔ 豆油(Y) ↔ 菜油(OI)  (替代)
 *         菜籽 → 菜油(OI) + 菜粕(RM)
 * 棉花链: 棉花(CF) → 棉纱(CY), 涤纶短纤(PF) 替代
 * 饲料链: 玉米(C) → 淀粉(CS), 豆粕(M) 饲料需求
 * 养殖链: 鸡蛋(JD), 生猪(LH) — 饲料成本驱动
 */
export const agricultureSector: SectorConfig = {
  id: "agriculture",
  name: "农产品",
  symbols: ["P", "Y", "M", "OI", "RM", "CF", "SR", "AP", "C", "CS", "A", "JD", "LH", "SP", "PK"],

  costFormulas: {
    Y: {
      label: "豆油压榨成本",
      inputs: [{ symbol: "A", weight: 0.185, label: "大豆(出油率18.5%)" }],
      fees: 150,
    },
    M: {
      label: "豆粕压榨成本",
      inputs: [{ symbol: "A", weight: 0.785, label: "大豆(出粕率78.5%)" }],
      fees: 100,
    },
    CS: {
      label: "淀粉加工成本",
      inputs: [{ symbol: "C", weight: 1.4, label: "玉米(淀粉得率)" }],
      fees: 400,
    },
  },

  marginFormulas: {
    crush: {
      label: "大豆压榨利润",
      product: { symbol: "M", coefficient: 0.785 },
      rawMaterials: [
        { symbol: "A", coefficient: 1.0 },
        { symbol: "Y", coefficient: -0.185 },
      ],
      processingCost: 120,
    },
    JD_feed: {
      label: "蛋鸡养殖利润",
      product: { symbol: "JD", coefficient: 1.0 },
      rawMaterials: [
        { symbol: "C", coefficient: 1.8 },
        { symbol: "M", coefficient: 0.6 },
      ],
      processingCost: 1500,
    },
  },

  seasonalPatterns: [
    { symbol: "P", peakMonths: [2, 3, 4], troughMonths: [8, 9, 10], description: "棕榈油产量高峰2-4月(马来)" },
    { symbol: "Y", peakMonths: [9, 10, 11], troughMonths: [3, 4, 5], description: "大豆到港压榨旺季9-11月" },
    { symbol: "M", peakMonths: [9, 10, 11], troughMonths: [3, 4, 5], description: "压榨旺季豆粕供给增加" },
    { symbol: "CF", peakMonths: [9, 10, 11], troughMonths: [4, 5, 6], description: "纺织旺季9-11月，新棉上市10-12月" },
    { symbol: "SR", peakMonths: [11, 12, 1], troughMonths: [5, 6, 7], description: "榨季11-次年4月，消费旺季夏季" },
    { symbol: "AP", peakMonths: [3, 4, 5], troughMonths: [9, 10, 11], description: "苹果青黄不接3-5月，新果上市9-11月" },
    { symbol: "C", peakMonths: [10, 11, 12], troughMonths: [5, 6, 7], description: "新粮上市10-12月" },
    { symbol: "LH", peakMonths: [12, 1, 6, 7], troughMonths: [3, 4, 5], description: "春节+烧烤季需求旺" },
    { symbol: "JD", peakMonths: [8, 9, 1], troughMonths: [4, 5, 6], description: "中秋+春节备货旺季" },
  ],

  substitutePairs: [
    { symbolA: "P", symbolB: "Y", threshold: 800, direction: "positive", label: "棕榈油-豆油替代" },
    { symbolA: "Y", symbolB: "OI", threshold: 1200, direction: "positive", label: "豆油-菜油替代" },
    { symbolA: "M", symbolB: "RM", threshold: 600, direction: "positive", label: "豆粕-菜粕替代" },
    { symbolA: "C", symbolB: "CS", threshold: 400, direction: "positive", label: "玉米-淀粉加工价差" },
  ],

  factorWeights: {
    cost:       { weight: 0.20, timeframe: "daily" },
    margin:     { weight: 0.20, timeframe: "daily" },
    inventory:  { weight: 0.20, timeframe: "weekly" },
    seasonal:   { weight: 0.25, timeframe: "monthly" },
    substitute: { weight: 0.15, timeframe: "daily" },
  },
};
