import { getWeaviateClient } from "./client";
import { COLLECTION_NAMES } from "./schema";

export interface RegimeContextRecord {
  regimeLabel: string;
  macroRegime: string;
  liquidity: string;
  usd: string;
  commodityClusters: Record<string, string>;
  keyEvents: string[];
  confidence: number;
  snapshotAt: string;
}

export async function storeRegime(record: RegimeContextRecord): Promise<string> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.regime);

  const id = await collection.data.insert({
    properties: {
      regimeLabel: record.regimeLabel,
      macroRegime: record.macroRegime,
      liquidity: record.liquidity,
      usd: record.usd,
      commodityClusters: JSON.stringify(record.commodityClusters),
      keyEvents: record.keyEvents,
      confidence: record.confidence,
      snapshotAt: record.snapshotAt,
    },
  });

  return String(id);
}

export async function getCurrentRegime(): Promise<RegimeContextRecord | null> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.regime);

  const result = await collection.query.fetchObjects({
    limit: 10,
  });

  if (result.objects.length === 0) return null;

  // Sort by snapshotAt descending to get the latest record
  const sorted = result.objects.sort((a, b) => {
    const tsA = String(a.properties.snapshotAt ?? "");
    const tsB = String(b.properties.snapshotAt ?? "");
    return tsB.localeCompare(tsA);
  });
  const obj = sorted[0];
  let clusters: Record<string, string> = {};
  try {
    clusters = JSON.parse(String(obj.properties.commodityClusters ?? "{}"));
  } catch { /* ignore */ }

  return {
    regimeLabel: String(obj.properties.regimeLabel ?? ""),
    macroRegime: String(obj.properties.macroRegime ?? ""),
    liquidity: String(obj.properties.liquidity ?? ""),
    usd: String(obj.properties.usd ?? ""),
    commodityClusters: clusters,
    keyEvents: (obj.properties.keyEvents as string[]) ?? [],
    confidence: Number(obj.properties.confidence ?? 0),
    snapshotAt: String(obj.properties.snapshotAt ?? ""),
  };
}

export async function getRegimeHistory(
  limit: number = 30
): Promise<RegimeContextRecord[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.regime);

  const result = await collection.query.fetchObjects({
    limit,
  });

  return result.objects.map((obj) => {
    let clusters: Record<string, string> = {};
    try {
      clusters = JSON.parse(String(obj.properties.commodityClusters ?? "{}"));
    } catch { /* ignore */ }

    return {
      regimeLabel: String(obj.properties.regimeLabel ?? ""),
      macroRegime: String(obj.properties.macroRegime ?? ""),
      liquidity: String(obj.properties.liquidity ?? ""),
      usd: String(obj.properties.usd ?? ""),
      commodityClusters: clusters,
      keyEvents: (obj.properties.keyEvents as string[]) ?? [],
      confidence: Number(obj.properties.confidence ?? 0),
      snapshotAt: String(obj.properties.snapshotAt ?? ""),
    };
  });
}
