/**
 * TypeScript client for the Python backtest microservice.
 */

const BACKTEST_URL = process.env.BACKTEST_SERVICE_URL ?? "http://localhost:8100";

export interface BacktestLeg {
  asset: string;
  direction: "long" | "short";
  ratio: number;
}

export interface BacktestRequest {
  hypothesis_id: string;
  legs: BacktestLeg[];
  prices: Record<string, number[]>;
  dates: string[];
  entry_threshold?: number;
  exit_threshold?: number;
  stop_loss_threshold?: number;
  window?: number;
}

export interface BacktestResult {
  hypothesis_id: string;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_return: number;
  avg_holding_days: number;
  trade_count: number;
  ic: number;
  calmar_ratio: number;
  profit_factor: number;
}

export interface CausalRequest {
  hypothesis_id: string;
  treatment: string;
  outcome: string;
  prices: Record<string, number[]>;
  dates: string[];
  confounders?: string[];
}

export interface CausalResult {
  hypothesis_id: string;
  causal_effect: number;
  p_value: number;
  confidence_interval: [number, number];
  refutation_passed: boolean;
  method: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKTEST_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backtest service error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function runBacktest(req: BacktestRequest): Promise<BacktestResult> {
  return post<BacktestResult>("/backtest", req);
}

export async function runCausalValidation(req: CausalRequest): Promise<CausalResult> {
  return post<CausalResult>("/causal", req);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKTEST_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
