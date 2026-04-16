import type { LLMProvider, LLMProviderName, LLMConfig } from "./types";
import { createOpenAIProvider } from "./openai";
import { createAnthropicProvider } from "./anthropic";
import { createDeepSeekProvider } from "./deepseek";

const PROVIDER_FACTORIES: Record<LLMProviderName, (config: LLMConfig) => LLMProvider> = {
  openai: createOpenAIProvider,
  anthropic: createAnthropicProvider,
  deepseek: createDeepSeekProvider,
};

/**
 * Create an LLM provider instance from config.
 */
export function createProvider(config: LLMConfig): LLMProvider {
  const factory = PROVIDER_FACTORIES[config.provider];
  if (!factory) {
    throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
  return factory(config);
}

/**
 * Get the active LLM provider from DB config.
 * Falls back to env vars if DB is unavailable.
 */
export async function getActiveLLMProvider(): Promise<LLMProvider> {
  // Try DB config first
  try {
    const { db } = await import("@/db");
    const { llmConfig } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const configs = await db
      .select()
      .from(llmConfig)
      .where(eq(llmConfig.enabled, true))
      .limit(1);

    if (configs.length > 0) {
      const cfg = configs[0];
      return createProvider({
        provider: cfg.provider as LLMProviderName,
        apiKey: cfg.apiKey,
        model: cfg.model,
        enabled: true,
        baseUrl: cfg.baseUrl ?? undefined,
      });
    }
  } catch {
    // DB not available, fall through to env vars
  }

  // Fallback: env vars
  if (process.env.OPENAI_API_KEY) {
    return createProvider({
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || "gpt-4o",
      enabled: true,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return createProvider({
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
      enabled: true,
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return createProvider({
      provider: "deepseek",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.LLM_MODEL || "deepseek-chat",
      enabled: true,
    });
  }

  throw new Error("No LLM provider configured. Set up in Settings or provide API key env vars.");
}
