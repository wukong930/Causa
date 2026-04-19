"use client";

import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { RefreshBar } from "@/components/shared/RefreshBar";
import { CATEGORY_LABEL, ALERT_TYPE_LABEL } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

interface SignalRecord {
  id: string;
  alertId: string | null;
  signalType: string;
  category: string;
  confidence: number;
  zScore: number | null;
  regime: string | null;
  outcome: "hit" | "miss" | "pending" | "skipped";
  createdAt: string;
  resolvedAt: string | null;
  alertTitle?: string;
}

interface AnalyticsData {
  overall: { total: number; hits: number; misses: number; pending: number; hitRate: number; resolved: number };
  byCategory: Array<{ category: string; total: number; hits: number; misses: number; hitRate: number }>;
  byType: Array<{ signalType: string; total: number; hits: number; misses: number; hitRate: number }>;
  recent: SignalRecord[];
}

/* PLACEHOLDER_ANALYTICS_CONTENT */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>{label}</div>
      <div className="text-2xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>{sub}</div>}
    </div>
  );
}

function HitRateBar({ rate, total }: { rate: number; total: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "var(--surface-overlay)" }}>
        <div className="h-full rounded-full" style={{
          width: `${pct}%`,
          background: pct >= 60 ? "var(--positive)" : pct >= 40 ? "var(--alert-medium)" : "var(--negative)",
        }} />
      </div>
      <span className="text-xs font-mono shrink-0" style={{ color: "var(--foreground-muted)" }}>{pct}% ({total})</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refresh, isRefreshing, interval: refreshInterval, setInterval: setRefreshInterval, lastRefreshed } = useAutoRefresh(fetchData);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function markOutcome(id: string, outcome: "hit" | "miss") {
    setUpdatingId(id);
    await fetch("/api/analytics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, outcome }),
    });
    setData((prev) => prev ? {
      ...prev,
      recent: prev.recent.map((s) => s.id === id ? { ...s, outcome, resolvedAt: new Date().toISOString() } : s),
    } : prev);
    setUpdatingId(null);
    refresh();
  }

  const catLabel = (c: string) => (CATEGORY_LABEL as Record<string, string>)[c] ?? c;
  const typeLabel = (t: string) => (ALERT_TYPE_LABEL as Record<string, string>)[t] ?? t;

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>预测分析</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>预警准确率与建议胜率统计</p>
          </div>
          <RefreshBar isRefreshing={isRefreshing} interval={refreshInterval} lastRefreshed={lastRefreshed} onRefresh={refresh} onIntervalChange={setRefreshInterval} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0 p-5 max-w-6xl">
        {loading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: "var(--surface-overlay)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="总体准确率" value={`${Math.round(data.overall.hitRate * 100)}%`} sub={`${data.overall.resolved} 条已验证`} />
              <StatCard label="预测命中" value={String(data.overall.hits)} sub="标记为 Yes" />
              <StatCard label="预测失败" value={String(data.overall.misses)} sub="标记为 No" />
              <StatCard label="待验证" value={String(data.overall.pending)} sub="尚未标记" />
            </div>

            {/* By category + by type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="rounded-lg p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>按品类</h3>
                <div className="space-y-3">
                  {data.byCategory.map((c) => (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "var(--foreground)" }}>{catLabel(c.category)}</span>
                        <span style={{ color: "var(--foreground-subtle)" }}>{c.hits}/{c.hits + c.misses}</span>
                      </div>
                      <HitRateBar rate={c.hitRate} total={c.total} />
                    </div>
                  ))}
                  {data.byCategory.length === 0 && <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>暂无数据</p>}
                </div>
              </div>
              <div className="rounded-lg p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>按信号类型</h3>
                <div className="space-y-3">
                  {data.byType.map((t) => (
                    <div key={t.signalType}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "var(--foreground)" }}>{typeLabel(t.signalType)}</span>
                        <span style={{ color: "var(--foreground-subtle)" }}>{t.hits}/{t.hits + t.misses}</span>
                      </div>
                      <HitRateBar rate={t.hitRate} total={t.total} />
                    </div>
                  ))}
                  {data.byType.length === 0 && <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>暂无数据</p>}
                </div>
              </div>
            </div>

            {/* Signal detail table */}
            <div className="rounded-lg border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-subtle)" }}>信号明细</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>预警</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>类型</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>品类</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>置信度</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>时间</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>结果</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--foreground-subtle)" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.filter((s) => s.outcome !== "skipped").map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle, var(--border))" }}>
                        <td className="px-4 py-2.5 max-w-[200px] truncate">
                          {s.alertId ? (
                            <Link href={`/alerts?selected=${s.alertId}`} className="hover:underline" style={{ color: "var(--accent-blue)" }}>
                              {s.alertTitle || "查看预警"}
                            </Link>
                          ) : (
                            <span style={{ color: "var(--foreground-subtle)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--foreground)" }}>{typeLabel(s.signalType)}</td>
                        <td className="px-4 py-2.5" style={{ color: "var(--foreground-muted)" }}>{catLabel(s.category)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "var(--foreground-muted)" }}>{(s.confidence * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5" style={{ color: "var(--foreground-subtle)" }}>{formatRelativeTime(s.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          {s.outcome === "hit" && <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "var(--positive-muted)", color: "var(--positive)" }}>Yes</span>}
                          {s.outcome === "miss" && <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "var(--negative-muted)", color: "var(--negative)" }}>No</span>}
                          {s.outcome === "pending" && <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>待验证</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {s.outcome === "pending" && (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => markOutcome(s.id, "hit")}
                                disabled={updatingId === s.id}
                                className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
                                style={{ background: "var(--positive-muted)", color: "var(--positive)" }}
                              >Yes</button>
                              <button
                                onClick={() => markOutcome(s.id, "miss")}
                                disabled={updatingId === s.id}
                                className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
                                style={{ background: "var(--negative-muted)", color: "var(--negative)" }}
                              >No</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.recent.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--foreground-subtle)" }}>暂无信号记录</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
