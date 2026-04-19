"use client";

import { useState, useEffect } from "react";
import {
  getAlerts,
  getStrategies,
  getRecommendations,
  getPositions,
  getCommodityNodes,
  getAccountSnapshot,
  getRiskVaR,
  getStressTest,
  getResearchReports,
} from "@/lib/api-client";
import type { Alert, StrategyPoolItem, Recommendation, PositionGroup, CommodityNode, AccountSnapshot, ResearchReport } from "@/types/domain";
import type { VaRResult } from "@/lib/risk/var";
import type { StressTestResult } from "@/lib/risk/stress";
import {
  SEVERITY_LABEL,
  SEVERITY_BG,
  CATEGORY_LABEL,
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUS_COLOR,
  RECOMMENDED_ACTION_LABEL,
} from "@/lib/constants";
import { formatRelativeTime, formatConfidence, clsx, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { NetValueChart } from "@/components/dashboard/NetValueChart";
import { AlertTrendChart } from "@/components/dashboard/AlertTrendChart";

// ─── Commodity Heatmap ───────────────────────────────────────────────────────

const CLUSTER_ORDER = ["ferrous", "nonferrous", "energy", "agriculture", "overseas"] as const;
const CLUSTER_LABEL: Record<string, string> = {
  ferrous: "黑色",
  nonferrous: "有色",
  energy: "能化",
  agriculture: "农产品",
  overseas: "海外",
};

function CommodityHeatmap() {
  const [nodes, setNodes] = useState<CommodityNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    getCommodityNodes().then(setNodes);
  }, []);

  const byCluster = CLUSTER_ORDER.reduce(
    (acc, c) => ({
      ...acc,
      [c]: nodes.filter((n) => n.cluster === c),
    }),
    {} as Record<string, CommodityNode[]>
  );

  const totalAlerts = nodes.reduce((sum, n) => sum + n.activeAlertCount, 0);

  const REGIME_LABEL: Record<string, string> = { trending: "趋势", ranging: "震荡", breakout: "突破", unknown: "未知" };

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          品种热力图
        </h3>
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {totalAlerts > 0 && (
            <span style={{ color: "var(--alert-high)" }}>{totalAlerts} 个品种有预警</span>
          )}
          {totalAlerts === 0 && "无活跃预警"}
        </span>
      </div>

      <div className="space-y-3">
        {CLUSTER_ORDER.map((cluster) => {
          const clusterNodes = byCluster[cluster];
          if (!clusterNodes || clusterNodes.length === 0) return null;

          return (
            <div key={cluster}>
              <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>
                {CLUSTER_LABEL[cluster]}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clusterNodes.map((node) => {
                  const pct = node.priceChange24h ?? 0;
                  const isUp = pct >= 0;
                  const intensity = Math.min(Math.abs(pct) / 3, 1);
                  const hasAlert = node.activeAlertCount > 0;
                  const isHovered = hoveredNode === node.id;

                  return (
                    <div
                      key={node.id}
                      className="relative flex items-center gap-1 px-2 py-1 rounded cursor-default transition-all"
                      style={{
                        background: isUp
                          ? `rgba(63, 185, 80, ${0.12 + intensity * 0.25})`
                          : `rgba(248, 81, 73, ${0.12 + intensity * 0.25})`,
                        border: hasAlert
                          ? "1px solid var(--alert-high)"
                          : `1px solid ${isUp ? "rgba(63,185,80,0.25)" : "rgba(248,81,73,0.25)"}`,
                        animation: hasAlert ? "pulse 2s ease-in-out infinite" : undefined,
                      }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                        {node.name}
                      </span>
                      <span className="text-xs font-mono" style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                      {hasAlert && (
                        <span className="text-xs px-1 rounded-full" style={{ background: "var(--alert-high)", color: "#fff", fontSize: "8px" }}>
                          {node.activeAlertCount}
                        </span>
                      )}
                      {/* Hover card */}
                      {isHovered && (
                        <div
                          className="absolute left-0 bottom-full mb-2 z-20 rounded-lg p-3 shadow-lg min-w-[180px]"
                          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)" }}
                        >
                          <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                            {node.name} <span className="font-mono text-xs" style={{ color: "var(--foreground-muted)" }}>{node.symbol}</span>
                          </div>
                          <div className="space-y-1 text-xs" style={{ color: "var(--foreground-muted)" }}>
                            <div>交易所：{node.exchange}</div>
                            <div>24h 涨跌：<span style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span></div>
                            <div>市场状态：{REGIME_LABEL[node.regime] || node.regime}</div>
                            {hasAlert && (
                              <Link href={`/alerts?asset=${node.symbol}`} className="block mt-1 pt-1 border-t" style={{ borderColor: "var(--border)", color: "var(--alert-high)" }}>
                                {node.activeAlertCount} 条活跃预警 →
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(63,185,80,0.3)" }} />
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>上涨</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(248,81,73,0.3)" }} />
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>下跌</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border" style={{ borderColor: "var(--alert-high)" }} />
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>有预警</span>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ──────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <Link
      href={`/alerts?id=${alert.id}`}
      className="block rounded-lg border-l-2 p-4 transition-colors hover:brightness-110"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftWidth: "3px",
        borderLeftColor:
          alert.severity === "critical"
            ? "var(--alert-critical)"
            : alert.severity === "high"
            ? "var(--alert-high)"
            : alert.severity === "medium"
            ? "var(--alert-medium)"
            : "var(--alert-low)",
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className={clsx("text-xs font-semibold px-1.5 py-0.5 rounded shrink-0", SEVERITY_BG[alert.severity])}
          style={{
            color:
              alert.severity === "critical"
                ? "var(--alert-critical)"
                : alert.severity === "high"
                ? "var(--alert-high)"
                : alert.severity === "medium"
                ? "var(--alert-medium)"
                : "var(--alert-low)",
          }}
        >
          {SEVERITY_LABEL[alert.severity]}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
        >
          {CATEGORY_LABEL[alert.category]}
        </span>
        <span className="ml-auto text-xs shrink-0" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(alert.triggeredAt)}
        </span>
      </div>
      <div className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
        {alert.title}
      </div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
        {alert.summary}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <div className="flex gap-1.5">
          {alert.relatedAssets.slice(0, 3).map((a) => (
            <span
              key={a}
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)" }}
            >
              {a}
            </span>
          ))}
        </div>
        <span className="ml-auto text-xs" style={{ color: "var(--foreground-subtle)" }}>
          置信度 {formatConfidence(alert.confidence)}
        </span>
      </div>
    </Link>
  );
}

// ─── Strategy Row (compact) ──────────────────────────────────────────────────

function StrategyRow({ strategy }: { strategy: StrategyPoolItem }) {
  const legs = strategy.hypothesis.legs;
  const assets = legs.map((l) => l.asset);
  return (
    <Link
      href={`/strategies/${strategy.id}`}
      className="flex items-center gap-3 py-3 border-b last:border-b-0 hover:brightness-110"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          {strategy.name}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-2">
          <span style={{ color: "var(--foreground-subtle)" }}>{strategy.hypothesis.spreadModel.replace(/_/g, " ")}</span>
          <span>·</span>
          <span className="flex gap-1">
            {assets.map((a) => (
              <span key={a} className="font-mono" style={{ color: "var(--accent-blue)" }}>{a}</span>
            ))}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={clsx("text-xs font-medium", STRATEGY_STATUS_COLOR[strategy.status])}>
          {STRATEGY_STATUS_LABEL[strategy.status]}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          Z={strategy.hypothesis.currentZScore > 0 ? "+" : ""}{strategy.hypothesis.currentZScore.toFixed(2)}σ
        </div>
      </div>
    </Link>
  );
}

// ─── Recommendation Row (compact) ────────────────────────────────────────────

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const assets = rec.legs.map((l) => l.asset).join(" / ");
  return (
    <div
      className="flex items-center gap-3 py-3 border-b last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
          {assets}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {RECOMMENDED_ACTION_LABEL[rec.recommendedAction]} · 优先级 {rec.priorityScore}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          className="text-xs px-2 py-1 rounded font-medium"
          style={{ background: "var(--positive-muted)", color: "var(--positive)", border: "1px solid var(--positive)" }}
        >
          确认
        </button>
        <button
          className="text-xs px-2 py-1 rounded"
          style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
        >
          延后
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [strategies, setStrategies] = useState<StrategyPoolItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [positions, setPositions] = useState<PositionGroup[]>([]);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [varResult, setVarResult] = useState<VaRResult | null>(null);
  const [stressResults, setStressResults] = useState<StressTestResult[]>([]);
  const [latestReport, setLatestReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAlerts(),
      getStrategies(),
      getRecommendations(),
      getPositions(),
      getAccountSnapshot(),
      getRiskVaR(),
      getStressTest(),
      getResearchReports({ type: "daily" }),
    ]).then(([a, s, r, p, acct, vr, st, reports]) => {
      setAlerts(a);
      setStrategies(s);
      setRecommendations(r);
      setPositions(p);
      setAccountSnapshot(acct);
      setVarResult(vr);
      setStressResults(st ?? []);
      if (reports.length > 0) setLatestReport(reports[0]);
      setLoading(false);
    }).catch((err) => {
      console.error("Dashboard load error:", err);
      setLoading(false);
    });
  }, []);

  const activeAlerts = alerts
    .filter((a) => a.status === "active")
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    });

  const approachingStrategies = strategies
    .filter((s) => s.status === "approaching_trigger" || s.status === "active")
    .slice(0, 5);

  const pendingRecommendations = recommendations.filter((r) => r.status === "active");

  const account = accountSnapshot;
  const marginPct = account ? Math.round(account.marginUtilizationRate * 100) : 0;

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* ── Left main column ─────────────────────────────────────── */}
      <div
        className="flex-1 min-w-0 overflow-y-auto p-5 pb-20 md:pb-5"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>总览</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {new Date().toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded font-medium"
              style={{ background: "var(--alert-critical-muted)", color: "var(--alert-critical)" }}
            >
              {activeAlerts.filter((a) => a.severity === "critical").length} 极高
            </span>
            <span
              className="text-xs px-2 py-1 rounded font-medium"
              style={{ background: "var(--alert-high-muted)", color: "var(--alert-high)" }}
            >
              {activeAlerts.filter((a) => a.severity === "high").length} 高
            </span>
          </div>
        </div>

        {/* Net value + alert trend charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          <NetValueChart baseValue={account?.netValue ?? 1200000} />
          <AlertTrendChart alerts={alerts} />
        </div>

        {/* Risk overview */}
        {(varResult || stressResults.length > 0) && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                风控概览
              </h2>
              <Link href="/positions" className="text-xs" style={{ color: "var(--accent-blue)" }}>
                详情 →
              </Link>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
              {[
                { label: "VaR (95%)", value: varResult?.var95, color: "var(--alert-high)" },
                { label: "VaR (99%)", value: varResult?.var99, color: "var(--alert-critical)" },
                { label: "CVaR (95%)", value: varResult?.cvar95, color: "var(--alert-high)" },
                { label: "CVaR (99%)", value: varResult?.cvar99, color: "var(--alert-critical)" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg px-3 py-2.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>{m.label}</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: m.value ? m.color : "var(--foreground-subtle)" }}>
                    {m.value != null ? `¥${formatNumber(m.value)}` : "—"}
                  </div>
                </div>
              ))}
            </div>
            {stressResults.length > 0 && (() => {
              const worst = stressResults.reduce((w, s) => s.portfolioPnl < w.portfolioPnl ? s : w, stressResults[0]);
              return (
                <div
                  className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                  style={{ background: "var(--alert-critical-muted)", border: "1px solid var(--alert-critical)" }}
                >
                  <span className="text-xs" style={{ color: "var(--alert-critical)" }}>
                    最差场景：{worst.scenario}
                  </span>
                  <span className="text-xs font-mono font-semibold ml-auto" style={{ color: "var(--alert-critical)" }}>
                    ¥{formatNumber(worst.portfolioPnl)}
                  </span>
                </div>
              );
            })()}
          </section>
        )}

        {/* Alert feed */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              实时预警流
            </h2>
            <Link href="/alerts" className="text-xs" style={{ color: "var(--accent-blue)" }}>
              查看全部 →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {activeAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>

        {/* Today's events — dynamic from recent alerts */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            近期动态
          </h2>
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {[
              ...alerts.slice(0, 3).map((a) => ({
                time: new Date(a.triggeredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                label: a.title,
                tag: CATEGORY_LABEL[a.category] ?? a.category,
              })),
              ...pendingRecommendations.slice(0, 2).map((r) => ({
                time: new Date(r.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                label: `推荐：${r.legs.map((l) => l.asset).join("/")} ${RECOMMENDED_ACTION_LABEL[r.recommendedAction]}`,
                tag: "推荐",
              })),
            ].slice(0, 4).map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span
                  className="text-xs font-mono shrink-0 w-10"
                  style={{ color: "var(--foreground-subtle)" }}
                >
                  {ev.time}
                </span>
                <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>
                  {ev.label}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
                >
                  {ev.tag}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Right sidebar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[360px] shrink-0 overflow-y-auto p-5 gap-5">
        {/* Commodity heatmap */}
        <CommodityHeatmap />

        {/* Account status quick look */}
        {account ? (
          <section>
            <div
              className="rounded-lg p-4"
              style={{
                background: "var(--surface)",
                border: `1px solid ${
                  account.marginUtilizationRate >= 0.7
                    ? "var(--alert-critical)"
                    : account.marginUtilizationRate >= 0.5
                    ? "var(--alert-high)"
                    : "var(--border)"
                }`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  账户状态
                </h3>
                <Link href="/positions" className="text-xs" style={{ color: "var(--accent-blue)" }}>
                  持仓 →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>浮动盈亏</div>
                  <div
                    className="text-sm font-semibold font-mono"
                    style={{ color: account.totalUnrealizedPnl >= 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    {account.totalUnrealizedPnl >= 0 ? "+" : ""}¥{formatNumber(account.totalUnrealizedPnl)}
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>保证金占用</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                    {marginPct}%
                    {marginPct >= 50 && (
                      <span className="text-xs ml-1" style={{ color: marginPct >= 70 ? "var(--alert-critical)" : "var(--alert-high)" }}>
                        ⚠
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Margin bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
                  <span>保证金</span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--surface-overlay)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${marginPct}%`,
                      background:
                        marginPct >= 70 ? "var(--alert-critical)" :
                        marginPct >= 50 ? "var(--alert-high)" :
                        "var(--accent-blue)",
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div
              className="rounded-lg p-4 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
                连接账户数据…
              </div>
            </div>
          </section>
        )}

        {/* Pending recommendations */}
        {pendingRecommendations.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                待确认推荐
              </h2>
              <Link href="/recommendations" className="text-xs" style={{ color: "var(--accent-blue)" }}>
                查看全部 →
              </Link>
            </div>
            <div
              className="rounded-lg px-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {pendingRecommendations.map((r) => (
                <RecommendationRow key={r.id} rec={r} />
              ))}
            </div>
          </section>
        )}

        {/* Opportunity queue */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              机会队列
            </h2>
            <Link href="/strategies" className="text-xs" style={{ color: "var(--accent-blue)" }}>
              策略池 →
            </Link>
          </div>
          <div
            className="rounded-lg px-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {approachingStrategies.length > 0 ? (
              approachingStrategies.map((s) => <StrategyRow key={s.id} strategy={s} />)
            ) : (
              <p className="text-sm py-4 text-center" style={{ color: "var(--foreground-subtle)" }}>
                暂无接近触发的策略
              </p>
            )}
          </div>
        </section>

        {/* Research summary */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              研究摘要
            </h2>
            <Link href="/research" className="text-xs" style={{ color: "var(--accent-blue)" }}>
              研究页 →
            </Link>
          </div>
          <div
            className="rounded-lg p-4 text-sm leading-relaxed"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
          >
            {latestReport ? (
              <>
                <div className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  {latestReport.title}
                </div>
                {latestReport.summary || latestReport.body.slice(0, 200)}
              </>
            ) : (
              <p className="text-center py-2" style={{ color: "var(--foreground-subtle)" }}>暂无今日日报</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
