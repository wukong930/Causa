"use client";

import { useState } from "react";

const STRATEGIES = [
  { id: "mean_reversion", name: "均值回归" },
  { id: "momentum_breakout", name: "动量突破" },
  { id: "channel_breakout", name: "通道突破" },
  { id: "event_driven", name: "事件驱动" },
];

interface BtResult {
  sharpe_ratio: number; sortino_ratio: number; max_drawdown: number;
  win_rate: number; total_return: number; trade_count: number;
  profit_factor: number; calmar_ratio: number; total_cost: number;
  cost_drag_pct: number; avg_holding_days: number;
  equity_curve: { date: string; equity: number }[];
}

interface PanelConfig {
  strategy: string; sym1: string; sym2: string;
}

function MetricRow({ label, a, b, higherBetter = true }: { label: string; a: string; b: string; higherBetter?: boolean }) {
  const numA = parseFloat(a), numB = parseFloat(b);
  const aWins = higherBetter ? numA > numB : numA < numB;
  const bWins = higherBetter ? numB > numA : numB < numA;
  return (
    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <td className="py-2 px-3 text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</td>
      <td className="py-2 px-3 text-sm font-mono text-right" style={{ color: aWins ? "var(--positive)" : "var(--foreground)" }}>{a}</td>
      <td className="py-2 px-3 text-sm font-mono text-right" style={{ color: bWins ? "var(--positive)" : "var(--foreground)" }}>{b}</td>
    </tr>
  );
}

export default function ComparePage() {
  const [configA, setConfigA] = useState<PanelConfig>({ strategy: "mean_reversion", sym1: "CU", sym2: "ZN" });
  const [configB, setConfigB] = useState<PanelConfig>({ strategy: "momentum_breakout", sym1: "CU", sym2: "ZN" });
  const [resultA, setResultA] = useState<BtResult | null>(null);
  const [resultB, setResultB] = useState<BtResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runComparison() {
    setRunning(true); setError("");
    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sym1: configA.sym1, sym2: configA.sym2, strategy_type: configA.strategy, action: "backtest" }) }),
        fetch("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sym1: configB.sym1, sym2: configB.sym2, strategy_type: configB.strategy, action: "backtest" }) }),
      ]);
      if (!resA.ok || !resB.ok) throw new Error("回测请求失败");
      setResultA(await resA.json());
      setResultB(await resB.json());
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  }

  function ConfigPanel({ config, setConfig, label }: { config: PanelConfig; setConfig: (c: PanelConfig) => void; label: string }) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>{label}</div>
        <select value={config.strategy} onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
          className="w-full rounded px-3 py-2 text-sm"
          style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
          {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input value={config.sym1} onChange={(e) => setConfig({ ...config, sym1: e.target.value.toUpperCase() })}
            placeholder="品种1" className="flex-1 rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
          <input value={config.sym2} onChange={(e) => setConfig({ ...config, sym2: e.target.value.toUpperCase() })}
            placeholder="品种2" className="flex-1 rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>策略对比</h1>

      <section className="rounded-lg p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <ConfigPanel config={configA} setConfig={setConfigA} label="配置 A" />
        <ConfigPanel config={configB} setConfig={setConfigB} label="配置 B" />
        <button onClick={runComparison} disabled={running}
          className="rounded px-4 py-2 text-sm font-medium h-10"
          style={{ background: "var(--accent-primary)", color: "#fff", opacity: running ? 0.6 : 1 }}>
          {running ? "对比中..." : "运行对比"}
        </button>
      </section>

      {error && <div className="rounded-lg p-3 text-sm" style={{ background: "var(--negative-muted)", color: "var(--negative)" }}>{error}</div>}

      {resultA && resultB && (
        <>
          <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>指标对比</h2>
            <table className="w-full">
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 px-3 text-xs" style={{ color: "var(--foreground-muted)" }}>指标</th>
                <th className="text-right py-2 px-3 text-xs" style={{ color: "var(--foreground-muted)" }}>A: {STRATEGIES.find((s) => s.id === configA.strategy)?.name}</th>
                <th className="text-right py-2 px-3 text-xs" style={{ color: "var(--foreground-muted)" }}>B: {STRATEGIES.find((s) => s.id === configB.strategy)?.name}</th>
              </tr></thead>
              <tbody>
                <MetricRow label="Sharpe" a={resultA.sharpe_ratio.toFixed(3)} b={resultB.sharpe_ratio.toFixed(3)} />
                <MetricRow label="Sortino" a={resultA.sortino_ratio.toFixed(3)} b={resultB.sortino_ratio.toFixed(3)} />
                <MetricRow label="总收益" a={`${(resultA.total_return * 100).toFixed(1)}%`} b={`${(resultB.total_return * 100).toFixed(1)}%`} />
                <MetricRow label="最大回撤" a={`${(resultA.max_drawdown * 100).toFixed(1)}%`} b={`${(resultB.max_drawdown * 100).toFixed(1)}%`} higherBetter={false} />
                <MetricRow label="胜率" a={`${(resultA.win_rate * 100).toFixed(0)}%`} b={`${(resultB.win_rate * 100).toFixed(0)}%`} />
                <MetricRow label="交易次数" a={String(resultA.trade_count)} b={String(resultB.trade_count)} />
                <MetricRow label="盈亏比" a={resultA.profit_factor.toFixed(2)} b={resultB.profit_factor.toFixed(2)} />
                <MetricRow label="Calmar" a={resultA.calmar_ratio.toFixed(2)} b={resultB.calmar_ratio.toFixed(2)} />
                <MetricRow label="成本拖累" a={`${resultA.cost_drag_pct.toFixed(3)}%`} b={`${resultB.cost_drag_pct.toFixed(3)}%`} higherBetter={false} />
                <MetricRow label="平均持仓" a={`${resultA.avg_holding_days.toFixed(0)}天`} b={`${resultB.avg_holding_days.toFixed(0)}天`} higherBetter={false} />
              </tbody>
            </table>
          </section>

          {/* Overlaid equity curves */}
          {(resultA.equity_curve.length > 0 || resultB.equity_curve.length > 0) && (
            <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                权益曲线叠加 <span className="font-normal text-xs"><span style={{ color: "#d97706" }}>■ A</span> <span style={{ color: "#2563eb" }}>■ B</span></span>
              </h2>
              <DualEquityCurve a={resultA.equity_curve} b={resultB.equity_curve} />
            </section>
          )}

          {/* Conclusion */}
          <section className="rounded-lg p-4" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-sm" style={{ color: "var(--foreground)" }}>
              {resultA.sharpe_ratio > resultB.sharpe_ratio
                ? `配置 A (${STRATEGIES.find((s) => s.id === configA.strategy)?.name}) Sharpe 更高 (${resultA.sharpe_ratio.toFixed(2)} vs ${resultB.sharpe_ratio.toFixed(2)})，风险调整后收益更优。`
                : `配置 B (${STRATEGIES.find((s) => s.id === configB.strategy)?.name}) Sharpe 更高 (${resultB.sharpe_ratio.toFixed(2)} vs ${resultA.sharpe_ratio.toFixed(2)})，风险调整后收益更优。`}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DualEquityCurve({ a, b }: { a: { date: string; equity: number }[]; b: { date: string; equity: number }[] }) {
  const W = 800, H = 250, P = 40;
  const allEquities = [...a.map((d) => d.equity), ...b.map((d) => d.equity)];
  const minE = Math.min(...allEquities);
  const maxE = Math.max(...allEquities);
  const rangeE = maxE - minE || 1;

  function toPoints(data: { equity: number }[]) {
    return data.map((d, i) => {
      const x = P + (i / Math.max(data.length - 1, 1)) * (W - P * 2);
      const y = H - P - ((d.equity - minE) / rangeE) * (H - P * 2);
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
      {a.length > 0 && <polyline points={toPoints(a)} fill="none" stroke="#d97706" strokeWidth="2" />}
      {b.length > 0 && <polyline points={toPoints(b)} fill="none" stroke="#2563eb" strokeWidth="2" />}
      <text x={8} y={P + 4} fontSize="10" fill="var(--foreground-muted)">{maxE.toLocaleString()}</text>
      <text x={8} y={H - P} fontSize="10" fill="var(--foreground-muted)">{minE.toLocaleString()}</text>
    </svg>
  );
}
