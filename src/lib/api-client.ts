"use client";

import type {
  Alert,
  StrategyPoolItem,
  Recommendation,
  PositionGroup,
  ExecutionFeedback,
  ResearchReport,
  ResearchHypothesis,
  Suggestion,
  CommodityNode,
  RelationshipEdge,
  MarketDataPoint,
  SpreadStatistics,
  ExecutionDraft,
  CandidateRequest,
  AccountSnapshot,
  AlertType,
  AlertCategory,
} from "@/types/domain";
import type { ApiResult } from "@/types/api";
import { mockAlerts } from "@/mocks/alerts";
import { mockStrategies } from "@/mocks/strategies";
import { mockRecommendations } from "@/mocks/recommendations";
import { mockExecutionFeedbacks, mockPositionSnapshot } from "@/mocks/positions";
import { mockReports, mockResearchHypotheses as mockHypotheses } from "@/mocks/research";
import { mockSuggestions } from "@/mocks/suggestions";
import { mockNodes, mockEdges } from "@/mocks/graph";
import { mockExecutionDrafts } from "@/mocks/drafts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" || !process.env.DATABASE_URL;

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

    return response.json() as Promise<ApiResult<T>>;
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
      status: data.status ?? "pending",
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

// ─── Execution Feedback ──────────────────────────────────────────────────────

export async function getExecutionFeedbacks(): Promise<ExecutionFeedback[]> {
  if (USE_MOCK_DATA) return [...mockExecutionFeedbacks];

  const result = await fetchApi<ExecutionFeedback[]>("/api/execution-feedback");
  if (!result.success) return [...mockExecutionFeedbacks];
  return (result as { data: ExecutionFeedback[]; success: true }).data;
}

export async function getExecutionFeedback(
  id: string
): Promise<ExecutionFeedback | null> {
  if (USE_MOCK_DATA) return mockExecutionFeedbacks.find((f) => f.id === id) ?? null;

  const result = await fetchApi<ExecutionFeedback>(`/api/execution-feedback/${id}`);
  if (!result.success) return null;
  return (result as { data: ExecutionFeedback; success: true }).data;
}

export async function createExecutionFeedback(
  data: Partial<ExecutionFeedback>
): Promise<ExecutionFeedback> {
  if (USE_MOCK_DATA) {
    const now = new Date().toISOString();
    return {
      id: `fb-${Date.now()}`,
      legs: data.legs ?? [],
      totalMarginUsed: data.totalMarginUsed ?? 0,
      totalCommission: data.totalCommission ?? 0,
      slippageNote: data.slippageNote,
      liquidityNote: data.liquidityNote,
      notes: data.notes,
      recommendationId: data.recommendationId,
      strategyId: data.strategyId,
      createdAt: now,
      updatedAt: now,
    };
  }

  const result = await fetchApi<ExecutionFeedback>("/api/execution-feedback", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.success) throw new Error(result.error.message);
  return (result as { data: ExecutionFeedback; success: true }).data;
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

// ─── Suggestions ────────────────────────────────────────────────────────────────

export async function getSuggestions(filters?: {
  status?: string;
}): Promise<Suggestion[]> {
  if (USE_MOCK_DATA) return [...mockSuggestions];

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<Suggestion[]>(`/api/suggestions?${params}`);
  if (!result.success) return [...mockSuggestions];
  return (result as { data: Suggestion[]; success: true }).data;
}

export async function updateSuggestion(
  id: string,
  data: Partial<Suggestion>
): Promise<Suggestion | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<Suggestion>(`/api/suggestions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: Suggestion; success: true }).data;
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
  const result = await response.json() as { success: boolean; data?: { imported: number; errors: string[] }; error?: { message: string } };
  if (!result.success) throw new Error(result.error?.message ?? 'Import failed');
  return result.data!;
}

// ─── Candidate Generation ──────────────────────────────────────────────────────

export async function generateCandidates(params: {
  alertId?: string;
  strategyId?: string;
}): Promise<{ candidate: CandidateRequest; recommendation: Recommendation } | null> {
  if (USE_MOCK_DATA) return null;

  const result = await fetchApi<{ candidate: CandidateRequest; recommendation: Recommendation }>(
    '/api/candidates/generate',
    { method: 'POST', body: JSON.stringify(params) }
  );
  if (!result.success) return null;
  return (result as { data: { candidate: CandidateRequest; recommendation: Recommendation }; success: true }).data;
}

// ─── Execution Drafts ─────────────────────────────────────────────────────────

export async function getExecutionDrafts(filters?: {
  status?: string;
}): Promise<ExecutionDraft[]> {
  if (USE_MOCK_DATA) {
    let drafts = [...mockExecutionDrafts];
    if (filters?.status) drafts = drafts.filter((d) => d.status === filters.status);
    return drafts;
  }

  const params = new URLSearchParams(filters as Record<string, string>);
  const result = await fetchApi<ExecutionDraft[]>(`/api/execution-drafts?${params}`);
  if (!result.success) return [];
  return (result as { data: ExecutionDraft[]; success: true }).data;
}

export async function getExecutionDraft(id: string): Promise<ExecutionDraft | null> {
  if (USE_MOCK_DATA) return mockExecutionDrafts.find((d) => d.id === id) ?? null;

  const result = await fetchApi<ExecutionDraft>(`/api/execution-drafts/${id}`);
  if (!result.success) return null;
  return (result as { data: ExecutionDraft; success: true }).data;
}

export async function createExecutionDraft(recommendationId: string): Promise<ExecutionDraft | null> {
  if (USE_MOCK_DATA) {
    const rec = mockRecommendations.find((r) => r.id === recommendationId);
    if (!rec) return null;
    const draft: ExecutionDraft = {
      id: `draft-${Date.now()}`,
      recommendationId,
      status: "draft",
      legs: rec.legs.map((l) => ({
        asset: l.asset,
        direction: l.direction,
        type: "open" as const,
        requestedSize: l.suggestedSize,
        requestedPrice: l.entryPriceRef,
        unit: l.unit,
      })),
      totalMarginUsed: rec.marginRequired,
      totalCommission: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockExecutionDrafts.push(draft);
    return draft;
  }

  const result = await fetchApi<ExecutionDraft>('/api/execution-drafts', {
    method: 'POST',
    body: JSON.stringify({ recommendationId }),
  });
  if (!result.success) return null;
  return (result as { data: ExecutionDraft; success: true }).data;
}

export async function updateExecutionDraft(
  id: string,
  data: Partial<ExecutionDraft>
): Promise<ExecutionDraft | null> {
  if (USE_MOCK_DATA) {
    const idx = mockExecutionDrafts.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    mockExecutionDrafts[idx] = { ...mockExecutionDrafts[idx], ...data, updatedAt: new Date().toISOString() };
    return mockExecutionDrafts[idx];
  }

  const result = await fetchApi<ExecutionDraft>(`/api/execution-drafts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!result.success) return null;
  return (result as { data: ExecutionDraft; success: true }).data;
}

