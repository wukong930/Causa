import { getWeaviateClient } from "./client";
import weaviate from "weaviate-client";

/**
 * Weaviate collection definitions for the memory layer.
 * Three collections: HypothesisMemory, PerformanceMemory, RegimeContext
 */

export const COLLECTION_NAMES = {
  hypothesis: "HypothesisMemory",
  performance: "PerformanceMemory",
  regime: "RegimeContext",
} as const;

/**
 * Ensure all memory collections exist in Weaviate.
 * Safe to call multiple times — skips existing collections.
 */
export async function ensureMemorySchema() {
  const client = await getWeaviateClient();
  const existing = await client.collections.listAll();
  const existingNames = new Set(existing.map((c) => c.name));

  // HypothesisMemory
  if (!existingNames.has(COLLECTION_NAMES.hypothesis)) {
    await client.collections.create({
      name: COLLECTION_NAMES.hypothesis,
      description: "Historical trading hypotheses with outcomes",
      vectorizers: weaviate.configure.vectorizer.none(),
      properties: [
        { name: "hypothesisText", dataType: "text" as const },
        { name: "hypothesisType", dataType: "text" as const },
        { name: "spreadModel", dataType: "text" as const },
        { name: "assets", dataType: "text[]" as const },
        { name: "outcome", dataType: "text" as const },
        { name: "validationScore", dataType: "number" as const },
        { name: "confidence", dataType: "number" as const },
        { name: "strategyId", dataType: "text" as const },
        { name: "alertId", dataType: "text" as const },
        { name: "regimeLabel", dataType: "text" as const },
        { name: "createdAt", dataType: "text" as const },
        { name: "resolvedAt", dataType: "text" as const },
      ],
    });
  }

  // PerformanceMemory
  if (!existingNames.has(COLLECTION_NAMES.performance)) {
    await client.collections.create({
      name: COLLECTION_NAMES.performance,
      description: "Strategy performance snapshots",
      vectorizers: weaviate.configure.vectorizer.none(),
      properties: [
        { name: "strategyId", dataType: "text" as const },
        { name: "strategyName", dataType: "text" as const },
        { name: "hitRate", dataType: "number" as const },
        { name: "sharpeRatio", dataType: "number" as const },
        { name: "maxDrawdown", dataType: "number" as const },
        { name: "avgHoldingDays", dataType: "number" as const },
        { name: "totalPnl", dataType: "number" as const },
        { name: "tradeCount", dataType: "number" as const },
        { name: "regimeLabel", dataType: "text" as const },
        { name: "snapshotAt", dataType: "text" as const },
      ],
    });
  }

  // RegimeContext
  if (!existingNames.has(COLLECTION_NAMES.regime)) {
    await client.collections.create({
      name: COLLECTION_NAMES.regime,
      description: "Market regime snapshots",
      vectorizers: weaviate.configure.vectorizer.none(),
      properties: [
        { name: "regimeLabel", dataType: "text" as const },
        { name: "macroRegime", dataType: "text" as const },
        { name: "liquidity", dataType: "text" as const },
        { name: "usd", dataType: "text" as const },
        { name: "commodityClusters", dataType: "text" as const },
        { name: "keyEvents", dataType: "text[]" as const },
        { name: "confidence", dataType: "number" as const },
        { name: "snapshotAt", dataType: "text" as const },
      ],
    });
  }
}
