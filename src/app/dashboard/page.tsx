"use client";

import { useState, useEffect } from "react";
import {
  getAlerts,
  getStrategies,
  getRecommendations,
  getPositions,
  getCommodityNodes,
  getAccountSnapshot,
} from "@/lib/api-client";
import type { Alert, StrategyPoolItem, Recommendation, PositionGroup, CommodityNode, AccountSnapshot } from "@/types/domain";
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

// ─── Mock historical data ─────────────────────────────────────────────────────

// 14-day net value history (mock)
const NET_VALUE_HISTORY = [
  1180000, 1192000, 1205000, 1198000, 1210000, 1223000,
  1218000, 1235000, 1230000, 1245000, 1242000, 1258000,
  1248000, 1240000,
].map((v, i, arr) => {
  const date = new Date();
  date.setDate(date.getDate() - (arr.length - 1 - i));
  return { date: date.toISOString().slice(0, 10), value: v };
});

// 7-day alert count history (mock)
const ALERT_TREND = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - i));
  const label = date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  const count = [2, 1, 3, 2, 1, 4, 3][i];
  return { label, count };
});

// ─── Net Value Chart (SVG) ───────────────────────────────────────────────────

function NetValueChart() {
  const W = 560, H = 100, PAD = 4;
  const values = NET_VALUE_HISTORY.map((d) => d.value);
  const min = Math.min(...values) * 0.998;
  const max = Math.max(...values) * 1.002;
  const range = max - min || 1;

  function x(i: number) { return PAD + (i / (values.length - 1)) * (W - PAD * 2); }
  function y(v: number) { return H - PAD - ((v - min) / range) * (H - PAD * 2); }

  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const fillPts = `${PAD},${H - PAD} ${pts} ${x(values.length - 1)},${H - PAD}`;

  const current = values[values.length - 1];
  const prev = values[values.length - 2];
  const change = current - prev;
  const changePct = ((change / prev) * 100).toFixed(2);
  const isUp = change >= 0;

  // Generate area gradient path
  const areaPath = `M${x(0)},${H - PAD} ${values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(values.length - 1)},${H - PAD} Z`;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>账户净值</div>
          <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
            ¥{formatNumber(current)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>日涨跌</div>
          <div
            className="text-sm font-semibold font-mono"
            style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}
          >
            {isUp ? "+" : ""}¥{formatNumber(change)} ({isUp ? "+" : ""}{changePct}%)
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="netValueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD}
            y1={PAD + t * (H - PAD * 2)}
            x2={W - PAD}
            y2={PAD + t * (H - PAD * 2)}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#netValueGrad)" />

        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current point dot */}
        <circle
          cx={x(values.length - 1)}
          cy={y(values[values.length - 1])}
          r="3"
          fill="var(--accent-blue)"
        />

        {/* Date labels */}
        {[0, 6, 13].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 1}
            textAnchor="middle"
            fontSize="9"
            fill="var(--foreground-subtle)"
          >
            {NET_VALUE_HISTORY[i].date.slice(5)}
          </text>
        ))}
      </svg>

      <div className="flex justify-between text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
        <span>¥{formatNumber(min)}</span>
        <span>¥{formatNumber(max)}</span>
      </div>
    </div>
  );
}

// ─── Alert Trend Chart (SVG) ─────────────────────────────────────────────────

function AlertTrendChart() {
  const W = 560, H = 80, PAD = 4;
  const counts = ALERT_TREND.map((d) => d.count);
  const max = Math.max(...counts, 1);

  function barX(i: number) {
    const bw = (W - PAD * 2) / counts.length;
    return PAD + i * bw + bw * 0.15;
  }
  function barW() {
    return ((W - PAD * 2) / counts.length) * 0.7;
  }
  function barH(c: number) {
    return (c / max) * (H - PAD * 2);
  }
  function barY(c: number) {
    return H - PAD - barH(c);
  }

  const today = ALERT_TREND[ALERT_TREND.length - 1].label;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          预警趋势
        </h3>
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          近 7 天
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: "block", overflow: "visible" }}
      >
        {ALERT_TREND.map((d, i) => {
          const bh = barH(d.count);
          const isToday = d.label === today;
          return (
            <g key={d.label}>
              <rect
                x={barX(i)}
                y={barY(d.count)}
                width={barW()}
                height={bh}
                rx="2"
                fill={isToday ? "var(--alert-high)" : "var(--surface-overlay)"}
                stroke={isToday ? "var(--alert-high)" : "var(--border)"}
                strokeWidth="0.5"
              />
              <text
                x={barX(i) + barW() / 2}
                y={H - 1}
                textAnchor="middle"
                fontSize="8"
                fill={isToday ? "var(--alert-high)" : "var(--foreground-subtle)"}
              >
                {d.label}
              </text>
              <text
                x={barX(i) + barW() / 2}
                y={barY(d.count) - 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill={isToday ? "var(--alert-high)" : "var(--foreground-muted)"}
              >
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
          const nodes = byCluster[cluster];
          if (!nodes || nodes.length === 0) return null;

          return (
            <div key={cluster}>
              <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>
                {CLUSTER_LABEL[cluster]}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {nodes.map((node) => {
                  const pct = node.priceChange24h ?? 0;
                  const isUp = pct >= 0;
                  const intensity = Math.min(Math.abs(pct) / 3, 1);
                  const hasAlert = node.activeAlertCount > 0;

                  return (
                    <div
                      key={node.id}
                      className="flex items-center gap-1 px-2 py-1 rounded cursor-default transition-opacity hover:opacity-80"
                      style={{
                        background: isUp
                          ? `rgba(63, 185, 80, ${0.12 + intensity * 0.25})`
                          : `rgba(248, 81, 73, ${0.12 + intensity * 0.25})`,
                        border: hasAlert
                          ? "1px solid var(--alert-high)"
                          : `1px solid ${isUp ? "rgba(63,185,80,0.25)" : "rgba(248,81,73,0.25)"}`,
                      }}
                      title={`${node.name} (${node.exchange}) · ${node.regime} · 预警: ${node.activeAlertCount}`}
                    >
                      <span
                        className="text-xs font-mono font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {node.symbol}
                      </span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}
                      >
                        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                      {hasAlert && (
                        <span
                          className="text-xs px-1 rounded-full"
                          style={{
                            background: "var(--alert-high)",
                            color: "#fff",
                            fontSize: "8px",
                          }}
                        >
                          {node.activeAlertCount}
                        </span>
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
      href={`/alerts/${alert.id}`}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAlerts(),
      getStrategies(),
      getRecommendations(),
      getPositions(),
      getAccountSnapshot(),
    ]).then(([a, s, r, p, acct]) => {
      setAlerts(a);
      setStrategies(s);
      setRecommendations(r);
      setPositions(p);
      setAccountSnapshot(acct);
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

  const pendingRecommendations = recommendations.filter((r) => r.status === "pending");

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
          <NetValueChart />
          <AlertTrendChart />
        </div>

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

        {/* Today's events */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            今日重点事件
          </h2>
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {[
              { time: "09:30", label: "国家统计局公布 3 月工业数据（钢铁、铜产量）", tag: "黑色/有色" },
              { time: "10:00", label: "中国棕榈油协会周报发布", tag: "农产品" },
              { time: "14:00", label: "EIA 原油库存数据（昨夜已提前泄露）", tag: "能化" },
              { time: "21:30", label: "美国 CPI 数据（影响铜/金等有色板块）", tag: "海外" },
            ].map((ev) => (
              <div
                key={ev.time}
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
            <div className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
              今日日报（2026-04-14）
            </div>
            黑色板块：螺纹-热卷价差偏离显著，关注出口政策窗口；焦炭-焦煤利润压缩至历史低位，减产预期升温。能化：原油夜盘急跌拖累全链，关注 PP/TA/MEG 分化机会。农产品：棕榈油马盘大幅拉涨，国内基差修复机会值得跟踪。
          </div>
        </section>
      </div>
    </div>
  );
}
