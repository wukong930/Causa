"use client";

import type {
  Alert,
  StrategyPoolItem,
  Recommendation,
  PositionGroup,
  ResearchReport,
  ResearchHypothesis,
  CommodityNode,
  RelationshipEdge,
  MarketDataPoint,
  SpreadStatistics,
  AccountSnapshot,
  AlertType,
  AlertCategory,
} from "@/types/domain";
import type { VaRResult } from "@/lib/risk/var";
import type { StressTestResult, StressScenario } from "@/lib/risk/stress";
import type { CorrelationMatrix } from "@/lib/risk/correlation";
import type { BacktestRequest, BacktestResult, CausalRequest, CausalResult } from "@/lib/backtest/client";
import type { ApiResult } from "@/types/api";
import { mockAlerts } from "@/mocks/alerts";
import { mockStrategies } from "@/mocks/strategies";
import { mockRecommendations } from "@/mocks/recommendations";
import { mockPositionSnapshot } from "@/mocks/positions";
import { mockReports, mockResearchHypotheses as mockHypotheses } from "@/mocks/research";
import { mockNodes, mockEdges } from "@/mocks/graph";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

if (USE_MOCK_DATA && typeof window !== "undefined") {
  console.warn("[api-client] ⚠ Mock data mode is active. Set NEXT_PUBLIC_USE_MOCK_DATA=false for production.");
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      return { success: false, error: { code: `HTTP_${response.status}`, message: response.statusText } } as ApiResult<T>;
    }

    let data: ApiResult<T>;
    try {
      data = await response.json() as ApiResult<T>;
    } catch {
      return { success: false, error: { code: "PARSE_ERROR", message: "Invalid JSON response" } } as ApiResult<T>;
    }
    return data;
  } catch (err) {
    return { success: false, error: { code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Network error" } } as ApiResult<T>;
  }
}

// ─── Strategies ──────────────────────────────────────────────────────────────

export async function getStrategies(filters?: {
  status?: string;
  category?: string;
  search?: string;
}): Promise<StrategyPoolItem[]> {
  if (USE_MOCK_DATA) return [...mockStrategies];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<StrategyPoolItem[]>(`/api/strategies?${params}`);
  if (!result.success) return [...mockStrategies];
  return (result as { data: StrategyPoolItem[]; success: true }).data;
}

export async function getStrategy(id: string): Promise<StrategyPoolItem | null> {
  if (USE_MOCK_DATA) return mockStrategies.find((s) => s.id === id) ?? null;

  const result = await fetchApi<StrategyPoolItem>(`/api/strategies/${id}`);
  if (!result.success) return null;
  return (result as { data: StrategyPoolItem; success: true }).data;
}

export async function createStrategy(
  data: Partial<StrategyPoolItem>
): Promise<StrategyPoolItem> {
  if (USE_MOCK_DATA) {
    const now = new Date().toISOString();
    const created: StrategyPoolItem = {
      id: `strat-${Date.now()}`,
      name: data.name ?? "",
      description: data.description ?? "",
      status: "draft",
      hypothesis: data.hypothesis ?? {
        id: `hyp-${Date.now()}`,
        type: "spread" as const,
        spreadModel: "calendar_spread",
        legs: [],
        entryThreshold: 2,
        exitThreshold: 0.5,
        stopLossThreshold: 3.5,
        currentZScore: 0,
        halfLife: 0,
        adfPValue: 0,
        hypothesisText: "",
        createdAt: now,
        lastUpdated: now,
      },
      validation: data.validation ?? {
        hitRate: 0,
        sampleCount: 0,
        avgHoldingDays: 0,
        costSpreadRatio: 0,
        stressLoss: 0,
      },
      relatedAlertIds: [],
      recommendationHistory: [],
      executionFeedbackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    return created;
  }

  const result = await fetchApi<StrategyPoolItem>("/api/strategies", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.success) throw new Error(result.error.message);
  return (result as { data: StrategyPoolItem; success: true }).data;
}

export async function updateStrategy(
  id: string,
  data: Partial<StrategyPoolItem>
): Promise<StrategyPoolItem | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<StrategyPoolItem>(`/api/strategies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: StrategyPoolItem; success: true }).data;
}

export async function deleteStrategy(id: string): Promise<boolean> {
  if (USE_MOCK_DATA) return true;

  const result = await fetchApi<void>(`/api/strategies/${id}`, {
    method: "DELETE",
  });
  return result.success;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export async function getAlerts(filters?: {
  status?: string;
  severity?: string;
  category?: string;
}): Promise<Alert[]> {
  if (USE_MOCK_DATA) return [...mockAlerts];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<Alert[]>(`/api/alerts?${params}`);
  if (!result.success) return [...mockAlerts];
  return (result as { data: Alert[]; success: true }).data;
}

export async function getAlert(id: string): Promise<Alert | null> {
  if (USE_MOCK_DATA) return mockAlerts.find((a) => a.id === id) ?? null;

  const result = await fetchApi<Alert>(`/api/alerts/${id}`);
  if (!result.success) return null;
  return (result as { data: Alert; success: true }).data;
}

export async function updateAlert(
  id: string,
  data: Partial<Alert>
): Promise<Alert | null> {
  if (USE_MOCK_DATA) {
    const idx = mockAlerts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    Object.assign(mockAlerts[idx], data, { updatedAt: new Date().toISOString() });
    return mockAlerts[idx];
  }

  const result = await fetchApi<Alert>(`/api/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: Alert; success: true }).data;
}

// ─── Alert Trigger ─────────────────────────────────────────────────────────────

export async function triggerAlerts(params: {
  symbol1: string;
  symbol2?: string;
  alertTypes?: AlertType[];
  window?: number;
  category?: AlertCategory;
}): Promise<{ alerts: Alert[]; recommendations: Recommendation[] } | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<{ alerts: Alert[]; recommendations: Recommendation[] }>(
    "/api/alerts/trigger",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
  if (!result.success) return null;
  return (result as { data: { alerts: Alert[]; recommendations: Recommendation[] }; success: true }).data;
}

export async function createAlert(data: Partial<Alert>): Promise<Alert | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<Alert>("/api/alerts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: Alert; success: true }).data;
}

export async function expireAlerts(): Promise<{ count: number } | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<{ count: number }>("/api/alerts/expire", {
    method: "PATCH",
  });
  if (!result.success) return null;
  return (result as { data: { count: number }; success: true }).data;
}

export async function invalidateAlert(
  id: string,
  reason: string
): Promise<Alert | null> {
  if (USE_MOCK_DATA) {
    const idx = mockAlerts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    Object.assign(mockAlerts[idx], { status: "archived", invalidationReason: reason, updatedAt: new Date().toISOString() });
    return mockAlerts[idx];
  }

  const result = await fetchApi<Alert>(`/api/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "archived",
      invalidationReason: reason,
    }),
  });
  if (!result.success) return null;
  return (result as { data: Alert; success: true }).data;
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export async function getRecommendations(filters?: {
  status?: string;
  action?: string;
}): Promise<Recommendation[]> {
  if (USE_MOCK_DATA) return [...mockRecommendations];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<Recommendation[]>(`/api/recommendations?${params}`);
  if (!result.success) return [...mockRecommendations];
  return (result as { data: Recommendation[]; success: true }).data;
}

export async function getRecommendation(id: string): Promise<Recommendation | null> {
  if (USE_MOCK_DATA) return mockRecommendations.find((r) => r.id === id) ?? null;

  const result = await fetchApi<Recommendation>(`/api/recommendations/${id}`);
  if (!result.success) return null;
  return (result as { data: Recommendation; success: true }).data;
}

export async function updateRecommendation(
  id: string,
  data: Partial<Recommendation>
): Promise<Recommendation | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<Recommendation>(`/api/recommendations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: Recommendation; success: true }).data;
}

export async function createRecommendation(
  data: Partial<Recommendation>
): Promise<Recommendation> {
  const now = new Date().toISOString();
  if (USE_MOCK_DATA) {
    const rec: Recommendation = {
      id: `rec-${Date.now()}`,
      status: data.status ?? "active",
      recommendedAction: data.recommendedAction ?? "watchlist_only",
      legs: data.legs ?? [],
      priorityScore: data.priorityScore ?? 50,
      portfolioFitScore: data.portfolioFitScore ?? 50,
      marginEfficiencyScore: data.marginEfficiencyScore ?? 50,
      marginRequired: data.marginRequired ?? 0,
      reasoning: data.reasoning ?? "",
      riskItems: data.riskItems ?? [],
      expiresAt: data.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: now,
      updatedAt: now,
      strategyId: data.strategyId,
      alertId: data.alertId,
    };
    mockRecommendations.push(rec);
    return rec;
  }

  const result = await fetchApi<Recommendation>("/api/recommendations", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.success) throw new Error(result.error.message);
  return (result as { data: Recommendation; success: true }).data;
}

// ─── Positions ───────────────────────────────────────────────────────────────

export async function getPositions(filters?: {
  status?: string;
}): Promise<PositionGroup[]> {
  if (USE_MOCK_DATA) {
    let positions = [...mockPositionSnapshot.positions];
    if (filters?.status) positions = positions.filter((p) => p.status === filters.status);
    return positions;
  }

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<PositionGroup[]>(`/api/positions?${params}`);
  if (!result.success) return [];
  return (result as { data: PositionGroup[]; success: true }).data;
}

export async function getPosition(id: string): Promise<PositionGroup | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<PositionGroup>(`/api/positions/${id}`);
  if (!result.success) return null;
  return (result as { data: PositionGroup; success: true }).data;
}

export async function updatePosition(
  id: string,
  data: Partial<PositionGroup>
): Promise<PositionGroup | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<PositionGroup>(`/api/positions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: PositionGroup; success: true }).data;
}

// ─── Research Reports ──────────────────────────────────────────────────────────

export async function getResearchReports(filters?: {
  type?: string;
}): Promise<ResearchReport[]> {
  if (USE_MOCK_DATA) return [...mockReports];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<ResearchReport[]>(`/api/research/reports?${params}`);
  if (!result.success) return [...mockReports];
  return (result as { data: ResearchReport[]; success: true }).data;
}

export async function getResearchReport(id: string): Promise<ResearchReport | null> {
  if (USE_MOCK_DATA) return mockReports.find((r) => r.id === id) ?? null;

  const result = await fetchApi<ResearchReport>(`/api/research/reports/${id}`);
  if (!result.success) return null;
  return (result as { data: ResearchReport; success: true }).data;
}

// ─── Hypotheses ────────────────────────────────────────────────────────────────

export async function getHypotheses(filters?: {
  status?: string;
}): Promise<ResearchHypothesis[]> {
  if (USE_MOCK_DATA) return [...mockHypotheses];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<ResearchHypothesis[]>(`/api/research/hypotheses?${params}`);
  if (!result.success) return [...mockHypotheses];
  return (result as { data: ResearchHypothesis[]; success: true }).data;
}

export async function updateHypothesis(
  id: string,
  data: Partial<ResearchHypothesis>
): Promise<ResearchHypothesis | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<ResearchHypothesis>(`/api/research/hypotheses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: ResearchHypothesis; success: true }).data;
}

// ─── Commodity Graph ───────────────────────────────────────────────────────────

export async function getCommodityNodes(filters?: {
  cluster?: string;
}): Promise<CommodityNode[]> {
  if (USE_MOCK_DATA) return [...mockNodes];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<CommodityNode[]>(`/api/commodity-graph/nodes?${params}`);
  if (!result.success) return [...mockNodes];
  return (result as { data: CommodityNode[]; success: true }).data;
}

export async function getRelationshipEdges(): Promise<RelationshipEdge[]> {
  if (USE_MOCK_DATA) return [...mockEdges];

  const result = await fetchApi<RelationshipEdge[]>("/api/commodity-graph/edges");
  if (!result.success) return [...mockEdges];
  return (result as { data: RelationshipEdge[]; success: true }).data;
}

// ─── Account Snapshot ───────────────────────────────────────────────────────────

export async function getAccountSnapshot(): Promise<AccountSnapshot | null> {
  if (USE_MOCK_DATA) return { ...mockPositionSnapshot.account };

  const result = await fetchApi<AccountSnapshot>("/api/account/snapshot");
  if (!result.success) return null;
  return (result as { data: AccountSnapshot; success: true }).data;
}

// ─── Market Data ───────────────────────────────────────────────────────────────

export async function getMarketData(params: {
  symbol: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<MarketDataPoint[]> {
  const searchParams = new URLSearchParams({ symbol: params.symbol });
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const result = await fetchApi<MarketDataPoint[]>(`/api/market-data?${searchParams}`);
  if (!result.success) return [];
  return (result as { data: MarketDataPoint[]; success: true }).data;
}

export async function getSpreadStatistics(
  symbol1: string,
  symbol2: string,
  window?: number
): Promise<SpreadStatistics | null> {
  const searchParams = new URLSearchParams({ symbol1, symbol2 });
  if (window) searchParams.set('window', String(window));

  const result = await fetchApi<SpreadStatistics>(`/api/market-data/spread?${searchParams}`);
  if (!result.success) return null;
  return (result as { data: SpreadStatistics; success: true }).data;
}

export async function importMarketData(formData: FormData): Promise<{ imported: number; errors: string[] }> {
  const response = await fetch(`${API_BASE}/api/market-data/import`, {
    method: 'POST',
    body: formData,
  });
  let result: { success: boolean; data?: { imported: number; errors: string[] }; error?: { message: string } };
  try {
    result = await response.json();
  } catch {
    throw new Error('Invalid JSON response from import endpoint');
  }
  if (!result.success) throw new Error(result.error?.message ?? 'Import failed');
  return result.data!;
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export async function getRiskVaR(): Promise<VaRResult | null> {
  const result = await fetchApi<VaRResult>("/api/risk/var");
  if (!result.success) return null;
  return (result as { data: VaRResult; success: true }).data;
}

export async function getStressTest(): Promise<StressTestResult[] | null> {
  const result = await fetchApi<StressTestResult[]>("/api/risk/stress");
  if (!result.success) return null;
  return (result as { data: StressTestResult[]; success: true }).data;
}

export async function runStressTestClient(scenarios?: StressScenario[]): Promise<StressTestResult[] | null> {
  const result = await fetchApi<StressTestResult[]>("/api/risk/stress", {
    method: "POST",
    body: JSON.stringify(scenarios ? { scenarios } : {}),
  });
  if (!result.success) return null;
  return (result as { data: StressTestResult[]; success: true }).data;
}

export async function getCorrelationMatrix(symbols?: string[], window?: number): Promise<CorrelationMatrix | null> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  if (window) params.set("window", String(window));
  const result = await fetchApi<CorrelationMatrix>(`/api/risk/correlation?${params}`);
  if (!result.success) return null;
  return (result as { data: CorrelationMatrix; success: true }).data;
}

// ─── Backtest ────────────────────────────────────────────────────────────────

export async function runBacktestClient(req: BacktestRequest): Promise<BacktestResult | null> {
  const result = await fetchApi<BacktestResult>("/api/backtest/run", {
    method: "POST", body: JSON.stringify(req),
  });
  if (!result.success) return null;
  return (result as { data: BacktestResult; success: true }).data;
}

export async function runCausalValidationClient(req: CausalRequest): Promise<CausalResult | null> {
  const result = await fetchApi<CausalResult>("/api/backtest/causal", {
    method: "POST", body: JSON.stringify(req),
  });
  if (!result.success) return null;
  return (result as { data: CausalResult; success: true }).data;
}

// ─── Cron (Admin) ────────────────────────────────────────────────────────────

export async function triggerEvolutionCron(): Promise<unknown> {
  const result = await fetchApi<unknown>("/api/cron/evolution", { method: "POST" });
  return result.success ? (result as { data: unknown; success: true }).data : null;
}

export async function triggerContextCron(): Promise<unknown> {
  const result = await fetchApi<unknown>("/api/cron/context", { method: "POST" });
  return result.success ? (result as { data: unknown; success: true }).data : null;
}

export async function triggerRiskCron(): Promise<unknown> {
  const result = await fetchApi<unknown>("/api/cron/risk", { method: "POST" });
  return result.success ? (result as { data: unknown; success: true }).data : null;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface GDELTEvent {
  title: string;
  url: string;
  domain: string;
  language: string;
  seenDate: string;
  socialImage?: string;
}

export interface MacroSnapshot {
  usdIndex?: number;
  cpiYoY?: number;
  pmiManufacturing?: number;
  fedFundsRate?: number;
  us10yYield?: number;
  cn10yYield?: number;
  crudeBrent?: number;
  goldSpot?: number;
  copperLME?: number;
  ironOre62Fe?: number;
  balticDryIndex?: number;
  fetchedAt: string;
  source: string;
}

export async function getGDELTEvents(query?: string, limit?: number): Promise<GDELTEvent[]> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (limit) params.set("limit", String(limit));
  const result = await fetchApi<GDELTEvent[]>(`/api/context/gdelt?${params}`);
  if (!result.success) return [];
  return (result as { data: GDELTEvent[]; success: true }).data;
}

export async function getMacroIndicators(): Promise<MacroSnapshot | null> {
  const result = await fetchApi<MacroSnapshot>("/api/context/macro");
  if (!result.success) return null;
  return (result as { data: MacroSnapshot; success: true }).data;
}

// ─── Sector Intelligence ────────────────────────────────────────────────────

import type { MarketOverview, SectorDetail } from "@/lib/sector/hierarchy";

export async function getSectorOverview(): Promise<MarketOverview | null> {
  const result = await fetchApi<MarketOverview>("/api/sectors/overview");
  if (!result.success) return null;
  return (result as { data: MarketOverview; success: true }).data;
}

export async function getSectorAssessment(sectorId: string): Promise<SectorDetail | null> {
  const result = await fetchApi<SectorDetail>(`/api/sectors/${sectorId}/assessment`);
  if (!result.success) return null;
  return (result as { data: SectorDetail; success: true }).data;
}

import type { ScenarioAssumption, ScenarioResult } from "@/lib/sector/scenario";

export async function runScenarioAnalysis(assumptions: ScenarioAssumption[]): Promise<ScenarioResult | null> {
  const result = await fetchApi<ScenarioResult>("/api/sectors/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assumptions }),
  });
  if (!result.success) return null;
  return (result as { data: ScenarioResult; success: true }).data;
}
