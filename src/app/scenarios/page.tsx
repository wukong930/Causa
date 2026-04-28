"use client";

import { useState } from "react";
import Link from "next/link";
import { runScenarioAnalysis } from "@/lib/api-client";
import { COMMODITY_NAME_MAP } from "@/lib/constants";
import type { ScenarioResult, SymbolImpact, ScenarioAssumption } from "@/lib/sector/scenario";
import type { PropagationAlert } from "@/lib/sector/propagation";

const POPULAR_SYMBOLS = ["I", "RB", "SC", "TA", "PP", "RU", "NR", "BR", "P", "M", "CF", "J", "HC", "CU", "AL"];

function DirectionLabel({ direction, label }: { direction: number; label: string }) {
  const color = direction === 1 ? "var(--positive)" : direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)";
  return <span style={{ color }}>{label}</span>;
}

function DeltaBadge({ delta }: { delta: number }) {
  const color = delta > 0 ? "var(--positive)" : delta < 0 ? "var(--alert-high)" : "var(--foreground-muted)";
  return (
    <span className="text-xs font-mono font-medium" style={{ color }}>
      {delta > 0 ? "+" : ""}{delta}%
    </span>
  );
}

/* ── PLACEHOLDER_PAGE ── */

export default function ScenariosPage() {
  const [assumptions, setAssumptions] = useState<ScenarioAssumption[]>([
    { symbol: "I", priceChangePct: 0.2 },
  ]);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);

  function addAssumption() {
    setAssumptions((prev) => [...prev, { symbol: "SC", priceChangePct: 0.1 }]);
  }

  function removeAssumption(idx: number) {
    setAssumptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAssumption(idx: number, field: "symbol" | "priceChangePct", value: string) {
    setAssumptions((prev) =>
      prev.map((a, i) =>
        i === idx
          ? { ...a, [field]: field === "priceChangePct" ? parseFloat(value) / 100 : value }
          : a,
      ),
    );
  }

  async function runSimulation() {
    setLoading(true);
    try {
      const res = await runScenarioAnalysis(assumptions);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/sectors"
          className="text-xs px-2 py-1 rounded"
          style={{ background: "var(--surface-raised)", color: "var(--foreground-subtle)" }}
        >
          板块总览
        </Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>场景推演</h1>
      </div>

      {/* Assumption builder */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>假设条件</h2>

        {assumptions.map((a, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <select
              value={a.symbol}
              onChange={(e) => updateAssumption(idx, "symbol", e.target.value)}
              className="rounded px-2 py-1.5 text-sm"
              style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              {POPULAR_SYMBOLS.map((s) => (
                <option key={s} value={s}>{COMMODITY_NAME_MAP[s] ?? s} ({s})</option>
              ))}
            </select>

            <span className="text-sm" style={{ color: "var(--foreground-subtle)" }}>价格变动</span>

            <div className="flex items-center gap-1">
              <input
                type="number"
                value={Math.round(a.priceChangePct * 100)}
                onChange={(e) => updateAssumption(idx, "priceChangePct", e.target.value)}
                className="w-20 rounded px-2 py-1.5 text-sm text-right font-mono"
                style={{ background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
              <span className="text-sm" style={{ color: "var(--foreground-subtle)" }}>%</span>
            </div>

            {assumptions.length > 1 && (
              <button
                onClick={() => removeAssumption(idx)}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--alert-high)", background: "var(--alert-high-muted)" }}
              >
                删除
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button
            onClick={addAssumption}
            className="text-xs px-3 py-1.5 rounded"
            style={{ background: "var(--surface-raised)", color: "var(--foreground-subtle)", border: "1px solid var(--border)" }}
          >
            + 添加假设
          </button>
          <button
            onClick={runSimulation}
            disabled={loading}
            className="text-xs px-4 py-1.5 rounded font-medium"
            style={{
              background: loading ? "var(--surface-raised)" : "var(--accent-primary)",
              color: loading ? "var(--foreground-muted)" : "white",
            }}
          >
            {loading ? "计算中..." : "运行推演"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{result.summary}</p>
          </div>

          {/* Direct impacts */}
          {result.directImpacts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                直接影响 ({result.directImpacts.length} 个品种)
              </h2>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: "var(--surface-raised)" }}>
                      <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>品种</th>
                      <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>变动前</th>
                      <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>变动后</th>
                      <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>确信度变化</th>
                      <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>利润变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.directImpacts.map((d) => (
                      <tr key={d.symbol} style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          {d.symbolName} <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{d.symbol}</span>
                          {d.directionChanged && (
                            <span className="ml-1 text-xs px-1 rounded" style={{ background: "var(--alert-high-muted)", color: "var(--alert-high)" }}>翻转</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <DirectionLabel direction={d.before.direction} label={d.before.directionLabel} />
                          <span className="ml-1 font-mono" style={{ color: "var(--foreground-subtle)" }}>{d.before.convictionPct}%</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <DirectionLabel direction={d.after.direction} label={d.after.directionLabel} />
                          <span className="ml-1 font-mono" style={{ color: "var(--foreground-subtle)" }}>{d.after.convictionPct}%</span>
                        </td>
                        <td className="px-3 py-2"><DeltaBadge delta={d.convictionDelta} /></td>
                        <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--foreground-subtle)" }}>
                          {d.before.productionMargin != null && d.after.productionMargin != null
                            ? `${d.before.productionMargin.toFixed(0)} → ${d.after.productionMargin.toFixed(0)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Propagation impacts */}
          {result.propagationImpacts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                传导影响 ({result.propagationImpacts.length} 个品种)
              </h2>
              <div className="space-y-2">
                {result.propagationImpacts.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-4 py-3 flex items-center justify-between"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div>
                      <div className="text-sm" style={{ color: "var(--foreground)" }}>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded mr-2" style={{ background: "var(--surface-raised)" }}>
                          {p.path.join(" → ")}
                        </span>
                        <DirectionLabel
                          direction={p.impactDirection}
                          label={p.impactDirection === 1 ? "偏多" : p.impactDirection === -1 ? "偏空" : "中性"}
                        />
                      </div>
                      <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
                        {p.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
                        {(p.impactStrength * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                        {p.lagDays}日
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.directImpacts.length === 0 && result.propagationImpacts.length === 0 && (
            <div className="rounded-lg p-4 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>该假设条件下无显著影响</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
