import { mockAlerts, mockStrategies, mockRecommendations } from "@/lib/mockData";
import {
  SEVERITY_LABEL,
  SEVERITY_BG,
  CATEGORY_LABEL,
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUS_COLOR,
  RECOMMENDED_ACTION_LABEL,
} from "@/lib/constants";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import type { StrategyPoolItem, Recommendation } from "@/types/domain";
import Link from "next/link";

// ─── Alert Card ──────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: (typeof mockAlerts)[number] }) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="block rounded-lg border-l-2 p-4 transition-colors hover:brightness-110"
      style={{
        background: "var(--surface)",
        borderLeftColor:
          alert.severity === "critical"
            ? "var(--alert-critical)"
            : alert.severity === "high"
            ? "var(--alert-high)"
            : alert.severity === "medium"
            ? "var(--alert-medium)"
            : "var(--alert-low)",
        border: "1px solid var(--border)",
        borderLeftWidth: "3px",
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

// ─── Cluster Heatmap ─────────────────────────────────────────────────────────

const clusters = [
  { id: "ferrous", label: "黑色", count: 2, change: -0.8 },
  { id: "nonferrous", label: "有色", count: 1, change: 0.4 },
  { id: "energy", label: "能化", count: 1, change: -2.1 },
  { id: "agriculture", label: "农产品", count: 1, change: 1.8 },
  { id: "overseas", label: "海外", count: 0, change: -0.3 },
];

function ClusterHeatmap() {
  return (
    <div className="grid grid-cols-5 gap-2">
      {clusters.map((c) => {
        const isUp = c.change > 0;
        const intensity = Math.min(Math.abs(c.change) / 3, 1);
        return (
          <div
            key={c.id}
            className="rounded-lg p-3 text-center cursor-pointer transition-opacity hover:opacity-80"
            style={{
              background: isUp
                ? `rgba(63, 185, 80, ${0.15 + intensity * 0.3})`
                : `rgba(248, 81, 73, ${0.15 + intensity * 0.3})`,
              border: `1px solid ${isUp ? "rgba(63,185,80,0.3)" : "rgba(248,81,73,0.3)"}`,
            }}
          >
            <div className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
              {c.label}
            </div>
            <div
              className="text-sm font-semibold"
              style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}
            >
              {isUp ? "+" : ""}{c.change.toFixed(1)}%
            </div>
            {c.count > 0 && (
              <div className="text-xs mt-1" style={{ color: "var(--alert-critical)" }}>
                {c.count} 预警
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const activeAlerts = mockAlerts
    .filter((a) => a.status === "active")
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    });

  const approachingStrategies = mockStrategies
    .filter((s) => s.status === "approaching_trigger" || s.status === "active")
    .slice(0, 5);

  const pendingRecommendations = mockRecommendations.filter((r) => r.status === "pending");

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
              {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
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
        {/* Cluster heatmap */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            市场热力概览
          </h2>
          <ClusterHeatmap />
        </section>

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
