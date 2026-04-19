import { getActiveLLMProvider } from "@/lib/llm/registry";

/**
 * Generate a one-sentence plain-language summary using LLM.
 * Falls back to a truncated version of the input if LLM fails.
 */
export async function generateOneLiner(
  type: "alert" | "recommendation",
  summary: string
): Promise<string> {
  try {
    const llm = await getActiveLLMProvider();
    const result = await llm.complete({
      messages: [
        {
          role: "system",
          content: "你是一个大宗商品交易助手。用一句话（不超过30个中文字）总结核心要点，面向非专业交易员，语言通俗易懂。只输出总结，不要任何前缀或标点以外的内容。",
        },
        {
          role: "user",
          content: `请总结以下${type === "alert" ? "预警" : "交易建议"}：\n${summary}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 100,
    });
    const text = result.content.trim();
    return text || summary.slice(0, 60);
  } catch (err) {
    console.error("[one-liner] LLM failed, using fallback:", err);
    return summary.slice(0, 60);
  }
}
