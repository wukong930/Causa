/**
 * Prompt templates for LLM-powered features.
 * Each function returns an array of LLMMessage objects.
 */
import type { LLMMessage } from "./types";

const SYSTEM_BASE = `你是 Causa 智能套利系统的分析引擎。你的任务是基于系统提供的统计事实和产业数据，分析异常原因、评估风险、判断均值回归的可能性。

核心原则：
- 你是分析师，不是策略生成器。交易参数（入场/出场/止损/仓位）由统计模型决定，你不需要输出这些。
- 统计事实部分的数字是系统计算的，你不能修改。
- 供给驱动 > 情绪驱动
- 如果数据不足以得出结论，明确说"数据不足，无法判断"
- 保守评估：宁可漏掉机会，不可误判风险`;

export function hypothesisGenerationPrompt(params: {
  alertSummary: string;
  contextVector: string;
  relatedMemory: string;
  existingPositions: string;
  factSheet?: string;
}): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `基于以下统计事实和市场数据，分析本次异常信号：

## 统计事实（系统计算，不可修改）
${params.factSheet || "无额外统计事实"}

## 预警信号
${params.alertSummary}

## 当前市场环境
${params.contextVector}

## 相关历史（来自记忆层）
${params.relatedMemory}

## 当前持仓
${params.existingPositions}

请以 JSON 数组格式返回 1-3 个分析结论，每个包含：
- hypothesisText: 对异常的解释和交易方向判断
- type: "spread" | "directional"
- spreadModel: 价差模型类型（spread 类型必填）
- legs: 交易腿数组 [{ asset, direction, ratio, exchange }]
- analysis: 异常原因分析（结合持仓量、库存、基差等多维数据）
- historicalComparison: 与历史同类偏离的异同
- riskFactors: 阻碍均值回归的因素
- confidence: 0-1 你对均值回归发生的信心
- riskItems: 风险点数组

注意：
- 入场/出场/止损阈值由统计模型决定，你不需要输出
- 如果数据不足以支撑判断，降低 confidence 并在 riskItems 中说明
- 重点分析"为什么偏离"和"什么会阻碍回归"`,
    },
  ];
}

export function validationSummaryPrompt(params: {
  selectedHypotheses: string;
  rejectedHypotheses: string;
  cycleStats: string;
}): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `总结本轮假设演化周期的结果：

## 保留的假设
${params.selectedHypotheses}

## 淘汰的假设
${params.rejectedHypotheses}

## 周期统计
${params.cycleStats}

请总结：
1. 本轮保留了哪些类型的假设，为什么
2. 淘汰的假设有什么共同特征
3. 对下一轮演化的建议（应该探索什么方向，避免什么模式）

用简洁的中文回答，200 字以内。`,
    },
  ];
}

export function hypothesisEvolutionPrompt(params: {
  hypothesis: string;
  executionFeedback: string;
  currentMarket: string;
}): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `基于执行反馈和当前市场状态，演化以下假设：

## 原始假设
${params.hypothesis}

## 执行反馈
${params.executionFeedback}

## 当前市场
${params.currentMarket}

请以 JSON 格式返回演化后的假设，可以调整：
- 入场/出场/止损阈值
- 交易腿的品种或比例
- 价差模型类型
- 置信度

同时说明演化的理由。`,
    },
  ];
}

export function contextCompressionPrompt(params: {
  gdeltEvents: string;
  macroIndicators: string;
  statisticalRegime?: string;
}): LLMMessage[] {
  const statSection = params.statisticalRegime
    ? `\n## 统计 Regime 信号\n${params.statisticalRegime}\n`
    : "";

  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `将以下市场信息压缩为结构化的上下文向量：

## GDELT 事件
${params.gdeltEvents}

## 宏观指标
${params.macroIndicators}
${statSection}
请以 JSON 格式返回：
{
  "macro_regime": "inflation_up" | "inflation_down" | "growth_up" | "growth_down" | "stagflation" | "goldilocks",
  "liquidity": "easing" | "neutral" | "tightening",
  "usd": "strong" | "neutral" | "weak",
  "commodity_clusters": {
    "energy": "supply_constrained" | "demand_weak" | "balanced" | "oversupplied",
    "ferrous": "...",
    "nonferrous": "...",
    "agriculture": "..."
  },
  "key_events": ["最重要的 3 个事件摘要"],
  "regime_confidence": 0.0-1.0
}

注意：如果统计 Regime 信号与你从新闻/宏观数据得出的判断不一致，请在 key_events 中标注分歧，并适当降低 regime_confidence。`,
    },
  ];
}

export function researchReportPrompt(params: {
  topic: string;
  data: string;
  hypotheses: string;
}): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `撰写一份简短的研究报告：

## 主题
${params.topic}

## 数据
${params.data}

## 相关假设
${params.hypotheses}

要求：
- 标题简洁
- 摘要 100 字以内
- 正文分析关键发现
- 列出相关假设的验证状态
- 给出操作建议`,
    },
  ];
}
