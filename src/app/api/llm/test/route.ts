import { NextRequest, NextResponse } from "next/server";
import type { LLMProviderName } from "@/lib/llm/types";
import { createProvider } from "@/lib/llm/registry";

// POST /api/llm/test — test LLM connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, model, baseUrl } = body as {
      provider: LLMProviderName;
      apiKey: string;
      model: string;
      baseUrl?: string;
    };

    if (!provider || !apiKey || !model) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "provider, apiKey, model are required" } },
        { status: 400 }
      );
    }

    const llm = createProvider({ provider, apiKey, model, enabled: true, baseUrl });

    const result = await llm.complete({
      messages: [
        { role: "user", content: "Reply with exactly: OK" },
      ],
      temperature: 0,
      maxTokens: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        model: result.model,
        response: result.content.trim(),
        usage: result.usage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({
      success: false,
      error: { code: "CONNECTION_FAILED", message },
    });
  }
}
