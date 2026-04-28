import type { SectorConfig } from "./types";

/**
 * 能化板块 (Energy & Chemicals)
 *
 * 产业链: 原油(SC) → 石脑油 → 各化工品
 * SC → FU(燃料油), LU(低硫燃油), BU(沥青)
 * SC → TA(PTA) → PF(涤纶短纤)
 * SC → PP(聚丙烯), L(塑料), V(PVC)
 * SC → MEG(乙二醇), MA(甲醇), EB(苯乙烯)
 * SA(纯碱), UR(尿素) — 独立成本结构
 * RU(天然橡胶), NR(20号胶), BR(合成橡胶) — 橡胶产业链
 */
export const energySector: SectorConfig = {
  id: "energy",
  name: "能化",
  symbols: ["SC", "FU", "LU", "BU", "PP", "TA", "MEG", "MA", "EB", "PG", "SA", "UR", "V", "L", "RU", "NR", "BR"],

  costFormulas: {
    TA: {
      label: "PTA生产成本(石脑油路线)",
      inputs: [{ symbol: "SC", weight: 0.725, label: "原油(折PX)" }],
      fees: 600,
    },
    PP: {
      label: "聚丙烯生产成本",
      inputs: [{ symbol: "SC", weight: 0.60, label: "原油(折丙烯)" }],
      fees: 500,
    },
    MEG: {
      label: "乙二醇生产成本(煤制)",
      inputs: [{ symbol: "MA", weight: 0.80, label: "甲醇(煤制路线)" }],
      fees: 800,
    },
    FU: {
      label: "燃料油成本",
      inputs: [{ symbol: "SC", weight: 0.85, label: "原油" }],
      fees: 100,
    },
    RU: {
      label: "天然橡胶进口成本",
      inputs: [{ symbol: "NR", weight: 1.0, label: "20号胶(东南亚基准)" }],
      fees: 300,
      tariff: 0.20,
      vat: 0.13,
    },
    BR: {
      label: "合成橡胶生产成本(丁二烯路线)",
      inputs: [{ symbol: "SC", weight: 0.45, label: "原油(折丁二烯)" }],
      fees: 2500,
    },
  },

  marginFormulas: {
    TA_MEG: {
      label: "聚酯利润(PTA+MEG→涤纶)",
      product: { symbol: "TA", coefficient: 0.855 },
      rawMaterials: [{ symbol: "MEG", coefficient: 0.335 }],
      processingCost: 1200,
    },
    PP_MA: {
      label: "MTO利润(甲醇→聚丙烯)",
      product: { symbol: "PP", coefficient: 1.0 },
      rawMaterials: [{ symbol: "MA", coefficient: 3.0 }],
      processingCost: 500,
    },
    RU_TIRE: {
      label: "轮胎利润(天然橡胶→轮胎)",
      product: { symbol: "RU", coefficient: 1.0 },
      rawMaterials: [{ symbol: "BR", coefficient: 0.4 }],
      processingCost: 3000,
    },
  },

  seasonalPatterns: [
    { symbol: "SC", peakMonths: [1, 2, 11, 12], troughMonths: [4, 5, 9, 10], description: "冬季取暖需求旺季" },
    { symbol: "TA", peakMonths: [8, 9, 10], troughMonths: [1, 2, 3], description: "纺织旺季备货8-10月" },
    { symbol: "PP", peakMonths: [3, 4, 9, 10], troughMonths: [6, 7, 8], description: "下游开工旺季" },
    { symbol: "MA", peakMonths: [9, 10, 11], troughMonths: [5, 6, 7], description: "甲醇制烯烃旺季" },
    { symbol: "BU", peakMonths: [5, 6, 7, 8, 9], troughMonths: [11, 12, 1, 2], description: "道路施工旺季" },
    { symbol: "RU", peakMonths: [9, 10, 11], troughMonths: [2, 3, 4], description: "轮胎旺季备货9-11月, 停割季2-4月供应偏紧" },
    { symbol: "NR", peakMonths: [9, 10, 11], troughMonths: [2, 3, 4], description: "与RU同步, 东南亚停割季供应收缩" },
  ],

  substitutePairs: [
    { symbolA: "PP", symbolB: "L", threshold: 500, direction: "positive", label: "PP-塑料替代" },
    { symbolA: "TA", symbolB: "MEG", threshold: 1500, direction: "positive", label: "PTA-MEG聚酯原料替代" },
    { symbolA: "RU", symbolB: "BR", threshold: 2000, direction: "positive", label: "天然橡胶-合成橡胶替代" },
    { symbolA: "RU", symbolB: "NR", threshold: 800, direction: "positive", label: "天然橡胶-20号胶价差" },
  ],

  factorWeights: {
    cost:       { weight: 0.25, timeframe: "daily" },
    margin:     { weight: 0.20, timeframe: "daily" },
    inventory:  { weight: 0.20, timeframe: "weekly" },
    seasonal:   { weight: 0.15, timeframe: "monthly" },
    substitute: { weight: 0.20, timeframe: "daily" },
  },
};
