"use client";

import { useState } from "react";

const STRATEGIES = [
  { id: "mean_reversion", name: "均值回归", desc: "Z-Score 偏离入场，回归出场" },
  { id: "momentum_breakout", name: "动量突破", desc: "收益率突破分位数 + ATR 跟踪止损" },
  { id: "channel_breakout", name: "通道突破", desc: "Donchian 通道突破 + ATR 止损" },
  { id: "event_driven", name: "事件驱动", desc: "固定持有期 + 目标/止损" },
];

const STRATEGY_PARAMS: Record<string, { key: string; label: string; default: number; step: number }[]> = {
  mean_reversion: [
    { key: "entry_z", label: "入场Z", default: 2.0, step: 0.1 },
    { key: "exit_z", label: "出场Z", default: 0.5, step: 0.1 },
    { key: "window", label: "窗口期", default: 60, step: 10 },
  ],
  momentum_breakout: [
    { key: "lookback", label: "回看期", default: 20, step: 5 },
    { key: "entry_percentile", label: "入场分位(%)", default: 80, step: 5 },
    { key: "trailing_atr_mult", label: "ATR止损倍数", default: 2.0, step: 0.5 },
  ],
  channel_breakout: [
    { key: "channel_period", label: "通道周期", default: 40, step: 10 },
    { key: "atr_period", label: "ATR周期", default: 14, step: 2 },
    { key: "atr_stop_mult", label: "ATR止损倍数", default: 2.0, step: 0.5 },
  ],
  event_driven: [
    { key: "hold_days", label: "持有天数", default: 5, step: 1 },
    { key: "target_pct", label: "目标收益(%)", default: 3, step: 0.5 },
    { key: "stop_pct", label: "止损(%)", default: 2, step: 0.5 },
  ],
};

interface BacktestResult {
  hypothesis_id: string;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_return: number;
  avg_holding_days: number;
  trade_count: number;
  calmar_ratio: number;
  profit_factor: number;
  sortino_ratio: number;
  omega_ratio: number;
  max_drawdown_duration: number;
  recovery_factor: number;
  tail_ratio: number;
  total_cost: number;
  cost_drag_pct: number;
  equity_curve: { date: string; equity: number; drawdown: number }[];
  trades: { entry_date: string; exit_date: string; direction: string; pnl: number; return_pct: number; holding_days: number }[];
}

interface OptimizeResult {
  best_params: Record<string, number>;
  top_results: { sharpe_ratio: number; strategy_params: Record<string, number> }[];
  total_combinations: number;
  stable: boolean;
}

interface WalkForwardResult {
  splits: { split: number; train_sharpe: number; test_sharpe: number; test_win_rate: number }[];
  avg_oos_sharpe: number;
  sharpe_cv: number;
  stable: boolean;
  overall_score: number;
}

function EquityCurve({ data }: { data: { date: string; equity: number; drawdown: number }[] }) {
  const W = 800, H = 250, P = 40;
  const equities = data.map((d) => d.equity);
  const minE = Math.min(...equities);
  const maxE = Math.max(...equities);
  const rangeE = maxE - minE || 1;
  const points = data.map((d, i) => {
    const x = P + (i / (data.length - 1)) * (W - P * 2);
    const y = H - P - ((d.equity - minE) / rangeE) * (H - P * 2);
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `${P},${H - P} ${points} ${W - P},${H - P}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
      <polygon points={areaPoints} fill="rgba(217,119,6,0.15)" />
      <polyline points={points} fill="none" stroke="#d97706" strokeWidth="2" />
      <text x={P} y={H - 8} fontSize="10" fill="var(--foreground-muted)">{data[0]?.date}</text>
      <text x={W - P} y={H - 8} fontSize="10" fill="var(--foreground-muted)" textAnchor="end">{data[data.length - 1]?.date}</text>
      <text x={8} y={P + 4} fontSize="10" fill="var(--foreground-muted)">{maxE.toLocaleString()}</text>
      <text x={8} y={H - P} fontSize="10" fill="var(--foreground-muted)">{minE.toLocaleString()}</text>
    </svg>
  );
}

export default function BacktestPage() {
  const [strategyType, setStrategyType] = useState("mean_reversion");
  const [sym1, setSym1] = useState("CU");
  const [sym2, setSym2] = useState("ZN");
  const [params, setParams] = useState<Record<string, number>>({});
  const [running, setRunning] = useState("");
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);
  const [wfResult, setWfResult] = useState<WalkForwardResult | null>(null);
  const [error, setError] = useState("");

  const currentParams = STRATEGY_PARAMS[strategyType] || [];

  function getParam(key: string, def: number) {
    return params[key] ?? def;
  }

  function setParam(key: string, val: number) {
    setParams((p) => ({ ...p, [key]: val }));
  }

  function buildBody(action: string) {
    const sp: Record<string, number> = {};
    for (const p of currentParams) sp[p.key] = getParam(p.key, p.default);
    return {
      sym1, sym2, action, strategy_type: strategyType, strategy_params: sp,
      entryZ: sp.entry_z ?? 2.0, exitZ: sp.exit_z ?? 0.5, window: sp.window ?? 60,
    };
  }

  async function run(action: string) {
    setRunning(action);
    setError("");
    if (action === "backtest") { setResult(null); }
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(action)),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (action === "backtest") setResult(data);
      else if (action === "optimize") {
        setOptResult(data);
        // Auto-fill best params
        if (data.best_params?.strategy_params) {
          setParams((p) => ({ ...p, ...data.best_params.strategy_params }));
        }
      }
      else if (action === "walk-forward") setWfResult(data);
    } catch (e: any) {
      setError(e.message || "操作失败");
    } finally {
      setRunning("");
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>回测研究台</h1>

      {/* Strategy + Symbol config */}
      <section className="rounded-lg p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>策略模型</label>
            <select value={strategyType} onChange={(e) => { setStrategyType(e.target.value); setParams({}); setOptResult(null); setWfResult(null); }}
              className="w-full rounded px-3 py-2 text-sm"
              style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
              {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{STRATEGIES.find((s) => s.id === strategyType)?.desc}</div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>品种1 (多)</label>
            <input value={sym1} onChange={(e) => setSym1(e.target.value.toUpperCase())}
              className="w-full rounded px-3 py-2 text-sm"
              style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>品种2 (空)</label>
            <input value={sym2} onChange={(e) => setSym2(e.target.value.toUpperCase())}
              className="w-full rounded px-3 py-2 text-sm"
              style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
          </div>
        </div>

        {/* Dynamic strategy params */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {currentParams.map((p) => (
            <div key={p.key}>
              <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>{p.label}</label>
              <input type="number" step={p.step} value={getParam(p.key, p.default)}
                onChange={(e) => setParam(p.key, +e.target.value)}
                className="w-full rounded px-3 py-2 text-sm"
                style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => run("backtest")} disabled={!!running}
            className="rounded px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--accent-primary)", color: "#fff", opacity: running ? 0.6 : 1 }}>
            {running === "backtest" ? "运行中..." : "运行回测"}
          </button>
          <button onClick={() => run("optimize")} disabled={!!running}
            className="rounded px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)", opacity: running ? 0.6 : 1 }}>
            {running === "optimize" ? "搜索中..." : "自动优化"}
          </button>
          <button onClick={() => run("walk-forward")} disabled={!!running}
            className="rounded px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)", opacity: running ? 0.6 : 1 }}>
            {running === "walk-forward" ? "验证中..." : "Walk-Forward"}
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg p-3 text-sm" style={{ background: "var(--negative-muted)", color: "var(--negative)" }}>{error}</div>}

      {/* Optimize results */}
      {optResult && (
        <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            参数优化结果 <span className="font-normal text-xs" style={{ color: "var(--foreground-muted)" }}>({optResult.total_combinations} 组合, {optResult.stable ? "✓ 稳定" : "⚠ 不稳定"})</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--foreground-muted)" }}>#</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--foreground-muted)" }}>Sharpe</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: "var(--foreground-muted)" }}>参数</th>
              </tr></thead>
              <tbody>
                {optResult.top_results.slice(0, 5).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td className="py-2 px-3" style={{ color: i === 0 ? "var(--accent-primary)" : "var(--foreground)" }}>{i + 1}</td>
                    <td className="py-2 px-3 font-mono" style={{ color: "var(--foreground)" }}>{r.sharpe_ratio.toFixed(3)}</td>
                    <td className="py-2 px-3 font-mono text-xs" style={{ color: "var(--foreground-muted)" }}>{JSON.stringify(r.strategy_params)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Walk-forward results */}
      {wfResult && (
        <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Walk-Forward 验证 <span className="font-normal text-xs" style={{ color: wfResult.stable ? "var(--positive)" : "var(--negative)" }}>
              {wfResult.stable ? "✓ OOS稳定" : "✗ OOS不稳定"} | 评分 {wfResult.overall_score}/100
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2 rounded" style={{ background: "var(--surface-raised)" }}>
              <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>平均OOS Sharpe</div>
              <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{wfResult.avg_oos_sharpe.toFixed(3)}</div>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "var(--surface-raised)" }}>
              <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>Sharpe CV</div>
              <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{wfResult.sharpe_cv.toFixed(3)}</div>
            </div>
            <div className="text-center p-2 rounded" style={{ background: "var(--surface-raised)" }}>
              <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>综合评分</div>
              <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{wfResult.overall_score}</div>
            </div>
          </div>
          {/* Split bars */}
          <div className="flex gap-1 items-end h-16">
            {wfResult.splits.map((s) => (
              <div key={s.split} className="flex-1 flex flex-col items-center">
                <div className="w-full rounded-t" style={{
                  height: `${Math.max(4, Math.abs(s.test_sharpe) * 20)}px`,
                  background: s.test_sharpe >= 0 ? "var(--positive)" : "var(--negative)",
                  opacity: 0.7,
                }} />
                <div className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>{s.test_sharpe.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Backtest results */}
      {result && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Sharpe", value: result.sharpe_ratio.toFixed(2) },
              { label: "Sortino", value: result.sortino_ratio.toFixed(2) },
              { label: "总收益", value: `${(result.total_return * 100).toFixed(1)}%` },
              { label: "最大回撤", value: `${(result.max_drawdown * 100).toFixed(1)}%` },
              { label: "胜率", value: `${(result.win_rate * 100).toFixed(0)}%` },
              { label: "交易次数", value: String(result.trade_count) },
              { label: "成本拖累", value: `${result.cost_drag_pct.toFixed(3)}%` },
              { label: "总成本", value: `¥${result.total_cost.toLocaleString()}` },
              { label: "盈亏比", value: result.profit_factor.toFixed(2) },
              { label: "Calmar", value: result.calmar_ratio.toFixed(2) },
              { label: "Omega", value: result.omega_ratio.toFixed(2) },
              { label: "回撤天数", value: `${result.max_drawdown_duration}天` },
              { label: "平均持仓", value: `${result.avg_holding_days.toFixed(0)}天` },
              { label: "尾部比", value: result.tail_ratio.toFixed(2) },
            ].map((m) => (
              <div key={m.label} className="rounded-lg p-3 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>{m.label}</div>
                <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{m.value}</div>
              </div>
            ))}
          </section>

          {result.equity_curve.length > 0 && (
            <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>权益曲线</h2>
              <EquityCurve data={result.equity_curve} />
            </section>
          )}

          {result.trades.length > 0 && (
            <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>交易明细</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["入场", "出场", "盈亏", "收益率", "持仓天数"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: "var(--foreground-muted)" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>{t.entry_date}</td>
                        <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>{t.exit_date}</td>
                        <td className="py-2 px-3" style={{ color: t.pnl >= 0 ? "var(--positive)" : "var(--negative)" }}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(0)}</td>
                        <td className="py-2 px-3" style={{ color: t.return_pct >= 0 ? "var(--positive)" : "var(--negative)" }}>{t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%</td>
                        <td className="py-2 px-3" style={{ color: "var(--foreground-muted)" }}>{t.holding_days}天</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
