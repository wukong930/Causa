"use client";

import { useState } from "react";

const BACKTEST_URL = "/api/backtest";

const STRATEGIES = [
  { id: "mean_reversion", name: "均值回归", desc: "Z-Score 偏离入场，回归出场" },
  { id: "momentum", name: "动量突破", desc: "价格突破分位数入场" },
  { id: "spread_arbitrage", name: "价差套利", desc: "双腿协整价差交易" },
];

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
  equity_curve: { date: string; equity: number; drawdown: number }[];
  trades: { entry_date: string; exit_date: string; direction: string; pnl: number; return_pct: number; holding_days: number }[];
}

// PLACEHOLDER_PAGE_CONTINUE

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
  const [strategy, setStrategy] = useState("mean_reversion");
  const [sym1, setSym1] = useState("CU");
  const [sym2, setSym2] = useState("ZN");
  const [entryZ, setEntryZ] = useState(2.0);
  const [exitZ, setExitZ] = useState(0.5);
  const [window, setWindow] = useState(60);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");

  async function runBacktest() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(BACKTEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, sym1, sym2, entryZ, exitZ, window }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "回测失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>回测引擎</h1>

      {/* Config panel */}
      <section className="rounded-lg p-5 grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>策略</label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>品种1</label>
          <input value={sym1} onChange={(e) => setSym1(e.target.value.toUpperCase())}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>品种2</label>
          <input value={sym2} onChange={(e) => setSym2(e.target.value.toUpperCase())}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
        <div className="flex items-end">
          <button onClick={runBacktest} disabled={running}
            className="w-full rounded px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: "var(--accent-primary)", color: "#fff", opacity: running ? 0.6 : 1 }}>
            {running ? "运行中..." : "运行回测"}
          </button>
        </div>
        {/* PLACEHOLDER_PARAMS */}
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>入场Z</label>
          <input type="number" step={0.1} value={entryZ} onChange={(e) => setEntryZ(+e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>出场Z</label>
          <input type="number" step={0.1} value={exitZ} onChange={(e) => setExitZ(+e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--foreground-muted)" }}>窗口期</label>
          <input type="number" value={window} onChange={(e) => setWindow(+e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>
      </section>

      {error && <div className="rounded-lg p-3 text-sm" style={{ background: "var(--negative-muted)", color: "var(--negative)" }}>{error}</div>}

      {result && (
        <>
          {/* Metrics dashboard */}
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Sharpe", value: result.sharpe_ratio.toFixed(2) },
              { label: "Sortino", value: result.sortino_ratio.toFixed(2) },
              { label: "Calmar", value: result.calmar_ratio.toFixed(2) },
              { label: "总收益", value: `${(result.total_return * 100).toFixed(1)}%` },
              { label: "最大回撤", value: `${(result.max_drawdown * 100).toFixed(1)}%` },
              { label: "胜率", value: `${(result.win_rate * 100).toFixed(0)}%` },
              { label: "交易次数", value: String(result.trade_count) },
              { label: "Omega", value: result.omega_ratio.toFixed(2) },
              { label: "盈亏比", value: result.profit_factor.toFixed(2) },
              { label: "尾部比", value: result.tail_ratio.toFixed(2) },
              { label: "回撤天数", value: `${result.max_drawdown_duration}天` },
              { label: "平均持仓", value: `${result.avg_holding_days.toFixed(0)}天` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg p-3 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>{m.label}</div>
                <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{m.value}</div>
              </div>
            ))}
          </section>

          {/* Equity curve */}
          {result.equity_curve.length > 0 && (
            <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>权益曲线</h2>
              <EquityCurve data={result.equity_curve} />
            </section>
          )}

          {/* Trade list */}
          {result.trades.length > 0 && (
            <section className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>交易明细</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["入场", "出场", "盈亏", "收益率", "持仓天数"].map((h) => (
                        <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: "var(--foreground-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>{t.entry_date}</td>
                        <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>{t.exit_date}</td>
                        <td className="py-2 px-3" style={{ color: t.pnl >= 0 ? "var(--positive)" : "var(--negative)" }}>
                          {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(0)}
                        </td>
                        <td className="py-2 px-3" style={{ color: t.return_pct >= 0 ? "var(--positive)" : "var(--negative)" }}>
                          {t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                        </td>
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

