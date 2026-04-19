// ─── LLM Provider Abstraction ────────────────────────────────────────────────

export type LLMProviderName = "openai" | "anthropic" | "deepseek" | "xai";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  /** If set, request JSON output and parse against this hint */
  jsonMode?: boolean;
}

export interface LLMCompletionResult {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface LLMProvider {
  name: LLMProviderName;
  complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
}

export interface LLMConfig {
  provider: LLMProviderName;
  apiKey: string;
  model: string;
  enabled: boolean;
  baseUrl?: string;
}

/** Default models per provider */
export const DEFAULT_MODELS: Record<LLMProviderName, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini", "o1", "o1-mini"],
  anthropic: ["claude-opus-4-20250918", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  xai: ["grok-4-1-fast-reasoning", "grok-4-1-fast-non-reasoning", "grok-4-0709", "grok-3", "grok-3-mini"],
};
