/**
 * Prompt templates for LLM-powered features.
 * Each function returns an array of LLMMessage objects.
 */
import type { LLMMessage } from "./types";

const SYSTEM_BASE = `你是 Causa 智能套利系统的推理引擎。你的任务是基于市场数据、预警信号和历史记忆，生成、验证和演化交易假设。

核心原则：
- 不做价格预测，只做因子过滤
- 供给驱动 > 情绪驱动
- 跨品种/跨期 > 单品种方向
- 保守验证：只有统计显著的假设才值得推荐`;

export function hypothesisGenerationPrompt(params: {
  alertSummary: string;
  contextVector: string;
  relatedMemory: string;
  existingPositions: string;
}): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_BASE },
    {
      role: "user",
      content: `基于以下信息生成 3-5 个交易假设：

## 预警信号
${params.alertSummary}

## 当前市场环境
${params.contextVector}

## 相关历史假设（来自记忆层）
${params.relatedMemory}

## 当前持仓
${params.existingPositions}

请以 JSON 数组格式返回，每个假设包含：
- hypothesisText: 假设描述
- type: "spread" | "directional"
- spreadModel: 价差模型类型（spread 类型必填）
- legs: 交易腿数组 [{ asset, direction, ratio, exchange }]
- entryThreshold: 入场 z-score 阈值
- exitThreshold: 出场 z-score 阈值
- stopLossThreshold: 止损阈值
- reasoning: 推理过程
- confidence: 置信度 0-1
- riskItems: 风险点数组`,
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
