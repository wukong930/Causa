import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { llmConfig } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { LLMProviderName } from "@/lib/llm/types";
import { DEFAULT_MODELS } from "@/lib/llm/types";

// GET /api/llm/config — list all LLM configs
export async function GET() {
  try {
    const configs = await db
      .select({
        id: llmConfig.id,
        provider: llmConfig.provider,
        model: llmConfig.model,
        baseUrl: llmConfig.baseUrl,
        enabled: llmConfig.enabled,
        createdAt: llmConfig.createdAt,
        updatedAt: llmConfig.updatedAt,
      })
      .from(llmConfig)
      .orderBy(desc(llmConfig.updatedAt));

    return NextResponse.json({
      success: true,
      data: {
        configs: configs.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
        availableModels: DEFAULT_MODELS,
      },
    });
  } catch (error) {
    console.error("GET /api/llm/config error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load LLM config" } },
      { status: 500 }
    );
  }
}

// PUT /api/llm/config — create or update LLM config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, provider, apiKey, model, baseUrl, enabled } = body as {
      id?: string;
      provider: LLMProviderName;
      apiKey: string;
      model: string;
      baseUrl?: string;
      enabled?: boolean;
    };

    if (!provider || !apiKey || !model) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "provider, apiKey, model are required" } },
        { status: 400 }
      );
    }

    const now = new Date();

    if (id) {
      // Update existing
      const [updated] = await db
        .update(llmConfig)
        .set({ provider, apiKey, model, baseUrl: baseUrl ?? null, enabled: enabled ?? true, updatedAt: now })
        .where(eq(llmConfig.id, id))
        .returning({ id: llmConfig.id, provider: llmConfig.provider, model: llmConfig.model, enabled: llmConfig.enabled });

      return NextResponse.json({ success: true, data: updated });
    }

    // Disable other configs when creating a new enabled one
    if (enabled !== false) {
      await db.update(llmConfig).set({ enabled: false, updatedAt: now }).where(eq(llmConfig.enabled, true));
    }

    const [created] = await db
      .insert(llmConfig)
      .values({ provider, apiKey, model, baseUrl: baseUrl ?? null, enabled: enabled ?? true, createdAt: now, updatedAt: now })
      .returning({ id: llmConfig.id, provider: llmConfig.provider, model: llmConfig.model, enabled: llmConfig.enabled });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error("PUT /api/llm/config error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to save LLM config" } },
      { status: 500 }
    );
  }
}
