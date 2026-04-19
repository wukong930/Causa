"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Recommendation, RecommendationStatus } from "@/types/domain";
import { getRecommendations } from "@/lib/api-client";
import {
  RECOMMENDATION_STATUS_LABEL,
  RECOMMENDED_ACTION_LABEL,
  getCommodityName,
} from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { RefreshBar } from "@/components/shared/RefreshBar";

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full border transition-colors"
      style={{
        background: active ? "var(--accent-primary)" : "var(--surface)",
        color: active ? "#fff" : "var(--foreground-muted)",
        borderColor: active ? "var(--accent-primary)" : "var(--border)",
      }}
    >
      {label}
    </button>
  );
}

function RecommendationCard({
  rec,
  onClick,
}: {
  rec: Recommendation;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border p-4 transition-colors hover:brightness-110"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium font-mono truncate mb-0.5" style={{ color: "var(--foreground)" }}>
            {rec.legs.map((l) => getCommodityName(l.asset)).join(" / ")}
          </div>
          <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            {RECOMMENDED_ACTION_LABEL[rec.recommendedAction]}
          </div>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--foreground-muted)",
          }}
        >
          {RECOMMENDATION_STATUS_LABEL[rec.status]}
        </span>
      </div>

      <div className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: "var(--foreground-muted)" }}>
        {rec.reasoning}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>优先级</div>
            <div className="text-sm font-semibold font-mono" style={{ color: scoreColor(rec.priorityScore) }}>
              {rec.priorityScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>组合适配</div>
            <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              {rec.portfolioFitScore}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>保证金</div>
            <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              ¥{(rec.marginRequired / 1000).toFixed(0)}k
            </div>
          </div>
        </div>
      </div>

      {/* Backtest + structured params summary */}
      {(rec.backtestSummary || rec.riskRewardRatio || rec.maxHoldingDays) && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {rec.backtestSummary && (
            <>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-overlay)", color: rec.backtestSummary.sharpe >= 1 ? "var(--positive)" : "var(--foreground-muted)" }}>
                Sharpe {rec.backtestSummary.sharpe.toFixed(2)}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}>
                胜率 {(rec.backtestSummary.winRate * 100).toFixed(0)}%
              </span>
              {rec.backtestSummary.oosStable && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--positive-muted)", color: "var(--positive)" }}>
                  OOS稳定
                </span>
              )}
            </>
          )}
          {rec.riskRewardRatio && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}>
              盈亏比 {rec.riskRewardRatio.toFixed(1)}
            </span>
          )}
          {rec.maxHoldingDays && (
            <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}>
              ≤{rec.maxHoldingDays}天
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function generateRecPlainSummary(rec: Recommendation): string {
  const assets = rec.legs.map((l) => getCommodityName(l.asset));
  const actions = rec.legs.map((l) => `${l.direction === "long" ? "做多" : "做空"} ${getCommodityName(l.asset)} ${l.suggestedSize}${l.unit}`);
  if (rec.legs.length >= 2) {
    return `建议同时${actions.join("、")}，构建套利组合。优先级评分 ${rec.priorityScore} 分${rec.priorityScore >= 80 ? "（强烈建议关注）" : rec.priorityScore >= 60 ? "（值得考虑）" : "（仅供参考）"}，预估需要保证金约 ¥${(rec.marginRequired / 10000).toFixed(1)} 万。`;
  }
  return `建议${actions[0]}。优先级评分 ${rec.priorityScore} 分${rec.priorityScore >= 80 ? "（强烈建议关注）" : rec.priorityScore >= 60 ? "（值得考虑）" : "（仅供参考）"}，预估需要保证金约 ¥${(rec.marginRequired / 10000).toFixed(1)} 万。`;
}

const SCORE_TOOLTIPS = {
  priority: "综合 Z-Score 偏离度、半衰期回归速度、ADF 平稳性、置信度的加权得分。\n≥80 强烈建议关注\n60-79 值得考虑\n<60 仅供参考",
  portfolioFit: "与现有持仓的相关性、分散度、方向冲突评估。\n≥80 与组合高度互补\n<60 可能增加集中度风险",
  marginEfficiency: "预期收益与保证金占用的比值。\n≥80 资金利用率高\n<60 资金效率偏低",
};

function scoreColor(value: number): string {
  if (value >= 80) return "var(--positive)";
  if (value >= 60) return "var(--accent-primary)";
  return "var(--foreground-muted)";
}

function RecommendationDetail({
  rec,
}: {
  rec: Recommendation;
}) {
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  function ScoreCard({ label, value, tooltipKey }: { label: string; value: number; tooltipKey: keyof typeof SCORE_TOOLTIPS }) {
    const isOpen = openTooltip === tooltipKey;
    const color = scoreColor(value);
    return (
      <div className="rounded-lg p-3 text-center relative" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
        <div
          className="text-xs mb-1 cursor-pointer select-none"
          style={{ color: "var(--foreground-subtle)" }}
          onClick={(e) => { e.stopPropagation(); setOpenTooltip(isOpen ? null : tooltipKey); }}
        >
          {label} <span style={{ color: "var(--accent-primary)" }}>ⓘ</span>
        </div>
        <div className="text-xl font-semibold font-mono" style={{ color }}>
          {value}
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          {value >= 80 ? "优" : value >= 60 ? "良" : "低"}
        </div>
        {isOpen && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg p-3 text-left text-xs leading-relaxed shadow-lg"
            style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)", color: "var(--foreground-muted)", whiteSpace: "pre-line" }}
            onClick={(e) => e.stopPropagation()}
          >
            {SCORE_TOOLTIPS[tooltipKey]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-5" onClick={() => setOpenTooltip(null)}>
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
          >
            {RECOMMENDATION_STATUS_LABEL[rec.status]}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            {RECOMMENDED_ACTION_LABEL[rec.recommendedAction]}
          </span>
          {rec.strategyId && (
            <span className="text-xs font-mono" style={{ color: "var(--accent-primary)" }}>
              {rec.strategyId}
            </span>
          )}
        </div>

        <div className="font-mono text-sm mb-3" style={{ color: "var(--foreground)" }}>
          {rec.legs.map((l) => getCommodityName(l.asset)).join(" / ")}
        </div>

        <div className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {rec.reasoning}
        </div>

        {/* Plain summary */}
        <div
          className="rounded-lg p-4 mt-3"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-primary)" }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            <span className="text-xs font-semibold" style={{ color: "var(--accent-primary)" }}>通俗建议</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            {rec.oneLiner && (
              <span className="block font-semibold mb-1">{rec.oneLiner}</span>
            )}
            {rec.plainSummary || generateRecPlainSummary(rec)}
          </p>
        </div>
      </div>

      {/* Leg details */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
          套利腿
        </h3>
        <div className="flex flex-col gap-2">
          {rec.legs.map((leg, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-4 py-3"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <span
                className="text-xs font-bold px-2 py-0.5 rounded font-mono"
                style={{
                  background: leg.direction === "long" ? "var(--positive-muted)" : "var(--negative-muted)",
                  color: leg.direction === "long" ? "var(--positive)" : "var(--negative)",
                }}
              >
                {leg.direction === "long" ? "做多" : "做空"}
              </span>
              <span className="font-mono font-medium text-sm" style={{ color: "var(--foreground)" }}>
                {getCommodityName(leg.asset)}{leg.contractMonth ? ` ${leg.contractMonth}` : ""}
              </span>
              <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                {leg.suggestedSize} {leg.unit}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {leg.entryZone && Math.abs(leg.entryZone[0]) >= 10 && (
                  <span className="text-xs font-mono" style={{ color: "var(--accent-primary)" }}>
                    入场 {leg.entryZone[0].toLocaleString()}–{leg.entryZone[1].toLocaleString()}
                  </span>
                )}
                {leg.stopLoss != null && Math.abs(leg.stopLoss) >= 10 && (
                  <span className="text-xs font-mono" style={{ color: "var(--negative)" }}>
                    止损 {leg.stopLoss.toLocaleString()}
                  </span>
                )}
                {leg.takeProfit != null && Math.abs(leg.takeProfit) >= 10 && (
                  <span className="text-xs font-mono" style={{ color: "var(--positive)" }}>
                    目标 {leg.takeProfit.toLocaleString()}
                  </span>
                )}
                {!leg.entryZone && leg.entryPriceRef && Math.abs(leg.entryPriceRef) >= 10 && (
                  <span className="text-xs font-mono" style={{ color: "var(--foreground-subtle)" }}>
                    参考价 {leg.entryPriceRef.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
          综合评分
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <ScoreCard label="优先级" value={rec.priorityScore} tooltipKey="priority" />
          <ScoreCard label="组合适配" value={rec.portfolioFitScore} tooltipKey="portfolioFit" />
          <ScoreCard label="保证金效率" value={rec.marginEfficiencyScore} tooltipKey="marginEfficiency" />
        </div>
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 mt-3"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>预估保证金</span>
          <span className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
            ¥{rec.marginRequired.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Backtest summary + structured params */}
      {(rec.backtestSummary || rec.maxHoldingDays || rec.positionSizePct || rec.riskRewardRatio) && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
            回测与参数
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {rec.backtestSummary && (
              <>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>Sharpe</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: rec.backtestSummary.sharpe >= 1 ? "var(--positive)" : "var(--foreground)" }}>
                    {rec.backtestSummary.sharpe.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>胜率</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                    {(rec.backtestSummary.winRate * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>最大回撤</div>
                  <div className="text-sm font-semibold font-mono" style={{ color: "var(--negative)" }}>
                    {(rec.backtestSummary.maxDrawdown * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>OOS 稳定性</div>
                  <div className="text-sm font-semibold" style={{ color: rec.backtestSummary.oosStable ? "var(--positive)" : "var(--alert-high)" }}>
                    {rec.backtestSummary.oosStable ? "稳定" : "不稳定"}
                  </div>
                </div>
              </>
            )}
            {rec.riskRewardRatio && (
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>盈亏比</div>
                <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>{rec.riskRewardRatio.toFixed(2)}</div>
              </div>
            )}
            {rec.maxHoldingDays && (
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>最大持有</div>
                <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>{rec.maxHoldingDays} 天</div>
              </div>
            )}
            {rec.positionSizePct && (
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>建议仓位</div>
                <div className="text-sm font-semibold font-mono" style={{ color: "var(--foreground)" }}>{rec.positionSizePct}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk items */}
      {rec.riskItems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
            风险提示
          </h3>
          <div
            className="rounded-lg px-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {rec.riskItems.map((r) => (
              <div key={r} className="flex items-start gap-2 py-2.5 border-b last:border-b-0">
                <span style={{ color: "var(--alert-high)" }}>▲</span>
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>
        <span>创建于 {formatRelativeTime(rec.createdAt)}</span>
        <span>·</span>
        <span>到期 {formatRelativeTime(rec.expiresAt)}</span>
      </div>
    </div>
  );
}

const ALL_STATUSES: RecommendationStatus[] = [
  "active",
  "expired",
  "superseded",
];

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  const fetchRecs = useCallback(async () => {
    const data = await getRecommendations();
    setRecommendations(data);
    setLoading(false);
  }, []);

  const { refresh, isRefreshing, interval: refreshInterval, setInterval: setRefreshInterval, lastRefreshed } = useAutoRefresh(fetchRecs);

  useEffect(() => {
    setLoading(true);
    fetchRecs();
  }, [fetchRecs]);

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      // Tab filter
      if (activeTab === "current" && r.status !== "active") return false;
      if (activeTab === "history" && r.status === "active") return false;
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      return true;
    });
  }, [recommendations, statusFilter, activeTab]);

  const selectedRec = selectedId
    ? recommendations.find((r) => r.id === selectedId)
    : null;

  function toggleStatus(s: RecommendationStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function openRec(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  const counts = useMemo(() => {
    return ALL_STATUSES.reduce(
      (acc, s) => ({
        ...acc,
        [s]: recommendations.filter((x) => x.status === s).length,
      }),
      {} as Record<RecommendationStatus, number>
    );
  }, [recommendations]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-5 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              交易建议
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              共 {filtered.length} 条建议
              {statusFilter.length > 0 && "（已筛选）"}
            </p>
          </div>
          <RefreshBar
            isRefreshing={isRefreshing}
            interval={refreshInterval}
            lastRefreshed={lastRefreshed}
            onRefresh={refresh}
            onIntervalChange={setRefreshInterval}
          />
          <div className="flex items-center gap-2">
            {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{
                  background: "var(--surface-overlay)",
                  color: "var(--foreground-muted)",
                }}
              >
                {counts[s]} {RECOMMENDATION_STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-3 rounded-lg p-0.5" style={{ background: "var(--surface-overlay)" }}>
          {([["current", "当前建议"], ["history", "历史建议"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 text-xs py-1.5 rounded-md transition-colors font-medium"
              style={{
                background: activeTab === key ? "var(--surface)" : "transparent",
                color: activeTab === key ? "var(--foreground)" : "var(--foreground-muted)",
                boxShadow: activeTab === key ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs mr-1" style={{ color: "var(--foreground-subtle)" }}>状态：</span>
          {ALL_STATUSES.map((s) => (
            <FilterPill
              key={s}
              label={RECOMMENDATION_STATUS_LABEL[s]}
              active={statusFilter.includes(s)}
              onClick={() => toggleStatus(s)}
            />
          ))}
          {statusFilter.length > 0 && (
            <button
              className="text-xs px-2"
              style={{ color: "var(--foreground-subtle)" }}
              onClick={() => setStatusFilter([])}
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 animate-pulse"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className="flex-1">
                    <div className="h-4 w-1/2 rounded mb-1" style={{ background: "var(--surface-overlay)" }} />
                    <div className="h-3 w-1/3 rounded" style={{ background: "var(--surface-overlay)" }} />
                  </div>
                  <div className="h-5 w-16 rounded" style={{ background: "var(--surface-overlay)" }} />
                </div>
                <div className="h-3 w-full rounded mb-3" style={{ background: "var(--surface-overlay)" }} />
                <div className="h-3 w-2/3 rounded mb-3" style={{ background: "var(--surface-overlay)" }} />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 rounded" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-10 rounded" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-10 rounded" style={{ background: "var(--surface-overlay)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
              没有符合条件的建议
            </p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {filtered.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                onClick={() => openRec(rec.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="推荐详情"
        width="560px"
      >
        {selectedRec && (
          <RecommendationDetail rec={selectedRec} />
        )}
      </Drawer>
    </div>
  );
}
