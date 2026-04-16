import { getWeaviateClient } from "./client";
import { COLLECTION_NAMES } from "./schema";

export interface HypothesisMemoryRecord {
  hypothesisText: string;
  hypothesisType: "spread" | "directional";
  spreadModel?: string;
  assets: string[];
  outcome?: "profitable" | "loss" | "neutral" | "pending";
  validationScore?: number;
  confidence?: number;
  strategyId?: string;
  alertId?: string;
  regimeLabel?: string;
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Store a hypothesis in Weaviate memory.
 */
export async function storeHypothesis(
  record: HypothesisMemoryRecord,
  vector?: number[]
): Promise<string> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.hypothesis);

  const id = await collection.data.insert({
    properties: {
      hypothesisText: record.hypothesisText,
      hypothesisType: record.hypothesisType,
      spreadModel: record.spreadModel ?? "",
      assets: record.assets,
      outcome: record.outcome ?? "pending",
      validationScore: record.validationScore ?? 0,
      confidence: record.confidence ?? 0,
      strategyId: record.strategyId ?? "",
      alertId: record.alertId ?? "",
      regimeLabel: record.regimeLabel ?? "",
      createdAt: record.createdAt,
      resolvedAt: record.resolvedAt ?? "",
    },
    vectors: vector,
  });

  return String(id);
}

/**
 * Query hypotheses by vector similarity.
 */
export async function queryRelatedHypotheses(
  vector: number[],
  limit: number = 5
): Promise<Array<HypothesisMemoryRecord & { score: number }>> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.hypothesis);

  const result = await collection.query.nearVector(vector, {
    limit,
    returnMetadata: ["distance"],
  });

  return result.objects.map((obj) => ({
    hypothesisText: String(obj.properties.hypothesisText ?? ""),
    hypothesisType: String(obj.properties.hypothesisType ?? "spread") as "spread" | "directional",
    spreadModel: String(obj.properties.spreadModel ?? ""),
    assets: (obj.properties.assets as string[]) ?? [],
    outcome: String(obj.properties.outcome ?? "pending") as HypothesisMemoryRecord["outcome"],
    validationScore: Number(obj.properties.validationScore ?? 0),
    confidence: Number(obj.properties.confidence ?? 0),
    strategyId: String(obj.properties.strategyId ?? ""),
    alertId: String(obj.properties.alertId ?? ""),
    regimeLabel: String(obj.properties.regimeLabel ?? ""),
    createdAt: String(obj.properties.createdAt ?? ""),
    resolvedAt: String(obj.properties.resolvedAt ?? ""),
    score: 1 - (obj.metadata?.distance ?? 0),
  }));
}

/**
 * Update hypothesis outcome after resolution.
 */
export async function updateHypothesisOutcome(
  id: string,
  outcome: "profitable" | "loss" | "neutral",
  resolvedAt?: string
): Promise<void> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.hypothesis);

  await collection.data.update({
    id,
    properties: {
      outcome,
      resolvedAt: resolvedAt ?? new Date().toISOString(),
    },
  });
}

/**
 * Get hypothesis history for a strategy.
 */
export async function getHypothesisHistory(
  strategyId: string,
  limit: number = 20
): Promise<HypothesisMemoryRecord[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.hypothesis);

  const result = await collection.query.fetchObjects({
    limit,
    filters: collection.filter.byProperty("strategyId").equal(strategyId),
  });

  return result.objects.map((obj) => ({
    hypothesisText: String(obj.properties.hypothesisText ?? ""),
    hypothesisType: String(obj.properties.hypothesisType ?? "spread") as "spread" | "directional",
    spreadModel: String(obj.properties.spreadModel ?? ""),
    assets: (obj.properties.assets as string[]) ?? [],
    outcome: String(obj.properties.outcome ?? "pending") as HypothesisMemoryRecord["outcome"],
    validationScore: Number(obj.properties.validationScore ?? 0),
    confidence: Number(obj.properties.confidence ?? 0),
    strategyId: String(obj.properties.strategyId ?? ""),
    alertId: String(obj.properties.alertId ?? ""),
    regimeLabel: String(obj.properties.regimeLabel ?? ""),
    createdAt: String(obj.properties.createdAt ?? ""),
    resolvedAt: String(obj.properties.resolvedAt ?? ""),
  }));
}
