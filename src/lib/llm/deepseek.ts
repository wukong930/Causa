import type { LLMProvider, LLMCompletionOptions, LLMCompletionResult, LLMConfig } from "./types";

/**
 * DeepSeek uses OpenAI-compatible API format.
 */
export function createDeepSeekProvider(config: LLMConfig): LLMProvider {
  const baseUrl = config.baseUrl || "https://api.deepseek.com/v1";

  return {
    name: "deepseek",
    async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      };

      if (options.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content ?? "",
        usage: data.usage
          ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
          : undefined,
        model: data.model ?? config.model,
      };
    },
  };
}
