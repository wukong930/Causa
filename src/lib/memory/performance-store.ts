import { getWeaviateClient } from "./client";
import { COLLECTION_NAMES } from "./schema";

export interface PerformanceMemoryRecord {
  strategyId: string;
  strategyName: string;
  hitRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldingDays: number;
  totalPnl: number;
  tradeCount: number;
  regimeLabel?: string;
  snapshotAt: string;
}

export async function storePerformance(record: PerformanceMemoryRecord): Promise<string> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.performance);

  const id = await collection.data.insert({
    properties: {
      strategyId: record.strategyId,
      strategyName: record.strategyName,
      hitRate: record.hitRate,
      sharpeRatio: record.sharpeRatio,
      maxDrawdown: record.maxDrawdown,
      avgHoldingDays: record.avgHoldingDays,
      totalPnl: record.totalPnl,
      tradeCount: record.tradeCount,
      regimeLabel: record.regimeLabel ?? "",
      snapshotAt: record.snapshotAt,
    },
  });

  return String(id);
}

export async function queryPerformanceByRegime(
  regimeLabel: string,
  limit: number = 10
): Promise<PerformanceMemoryRecord[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.performance);

  const result = await collection.query.fetchObjects({
    limit,
    filters: collection.filter.byProperty("regimeLabel").equal(regimeLabel),
  });

  return result.objects.map((obj) => ({
    strategyId: String(obj.properties.strategyId ?? ""),
    strategyName: String(obj.properties.strategyName ?? ""),
    hitRate: Number(obj.properties.hitRate ?? 0),
    sharpeRatio: Number(obj.properties.sharpeRatio ?? 0),
    maxDrawdown: Number(obj.properties.maxDrawdown ?? 0),
    avgHoldingDays: Number(obj.properties.avgHoldingDays ?? 0),
    totalPnl: Number(obj.properties.totalPnl ?? 0),
    tradeCount: Number(obj.properties.tradeCount ?? 0),
    regimeLabel: String(obj.properties.regimeLabel ?? ""),
    snapshotAt: String(obj.properties.snapshotAt ?? ""),
  }));
}

export async function getStrategyPerformance(
  strategyId: string,
  limit: number = 20
): Promise<PerformanceMemoryRecord[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAMES.performance);

  const result = await collection.query.fetchObjects({
    limit,
    filters: collection.filter.byProperty("strategyId").equal(strategyId),
  });

  return result.objects.map((obj) => ({
    strategyId: String(obj.properties.strategyId ?? ""),
    strategyName: String(obj.properties.strategyName ?? ""),
    hitRate: Number(obj.properties.hitRate ?? 0),
    sharpeRatio: Number(obj.properties.sharpeRatio ?? 0),
    maxDrawdown: Number(obj.properties.maxDrawdown ?? 0),
    avgHoldingDays: Number(obj.properties.avgHoldingDays ?? 0),
    totalPnl: Number(obj.properties.totalPnl ?? 0),
    tradeCount: Number(obj.properties.tradeCount ?? 0),
    regimeLabel: String(obj.properties.regimeLabel ?? ""),
    snapshotAt: String(obj.properties.snapshotAt ?? ""),
  }));
}
