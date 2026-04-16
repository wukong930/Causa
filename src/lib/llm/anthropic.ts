import type { LLMProvider, LLMCompletionOptions, LLMCompletionResult, LLMConfig } from "./types";

export function createAnthropicProvider(config: LLMConfig): LLMProvider {
  const baseUrl = config.baseUrl || "https://api.anthropic.com";

  return {
    name: "anthropic",
    async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
      const systemMsg = options.messages.find((m) => m.role === "system");
      const userMessages = options.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: options.maxTokens ?? 2048,
        messages: userMessages,
      };

      if (systemMsg) {
        body.system = systemMsg.content;
      }

      if (options.temperature !== undefined) {
        body.temperature = options.temperature;
      }

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

      return {
        content: textBlock?.text ?? "",
        usage: data.usage
          ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
          : undefined,
        model: data.model ?? config.model,
      };
    },
  };
}
