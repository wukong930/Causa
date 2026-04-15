"use client";

import { useState, useMemo } from "react";
import { mockRecommendations as initialRecommendations } from "@/lib/mockData";
import type { Recommendation, RecommendationStatus } from "@/types/domain";
import {
  RECOMMENDATION_STATUS_LABEL,
  RECOMMENDED_ACTION_LABEL,
  RECOMMENDED_ACTION_COLOR,
} from "@/lib/constants";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";

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
        background: active ? "var(--accent-blue)" : "var(--surface)",
        color: active ? "#fff" : "var(--foreground-muted)",
        borderColor: active ? "var(--accent-blue)" : "var(--border)",
      }}
    >
      {label}
    </button>
  );
}

function RecommendationCard({
  rec,
  onClick,
  onConfirm,
  onDefer,
}: {
  rec: Recommendation;
  onClick: () => void;
  onConfirm: (id: string) => void;
  onDefer: (id: string) => void;
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
            {rec.legs.map((l) => l.asset).join(" / ")}
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
            <div className="text-sm font-semibold font-mono" style={{ color: rec.priorityScore >= 80 ? "var(--positive)" : "var(--foreground)" }}>
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

      {rec.status === "pending" && (
        <div className="flex gap-2">
          <button
            className="flex-1 text-sm py-2 rounded-lg font-medium"
            style={{ background: "var(--positive)", color: "#fff" }}
            onClick={(e) => { e.stopPropagation(); onConfirm(rec.id); }}
          >
            确认执行
          </button>
          <button
            className="text-sm px-3 py-2 rounded-lg"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            onClick={(e) => { e.stopPropagation(); onDefer(rec.id); }}
          >
            延后
          </button>
        </div>
      )}
    </button>
  );
}

function RecommendationDetail({
  rec,
  onConfirm,
  onDefer,
}: {
  rec: Recommendation;
  onConfirm?: (id: string) => void;
  onDefer?: (id: string) => void;
}) {
  return (
    <div className="p-5">
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
            <span className="text-xs font-mono" style={{ color: "var(--accent-blue)" }}>
              {rec.strategyId}
            </span>
          )}
        </div>

        <div className="font-mono text-sm mb-3" style={{ color: "var(--foreground)" }}>
          {rec.legs.map((l) => l.asset).join(" / ")}
        </div>

        <div className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {rec.reasoning}
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
                {leg.asset}
              </span>
              <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                {leg.suggestedSize} {leg.unit}
              </span>
              {leg.entryPriceRef && (
                <span className="ml-auto text-xs font-mono" style={{ color: "var(--foreground-subtle)" }}>
                  参考价 {leg.entryPriceRef}
                </span>
              )}
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
          <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>优先级</div>
            <div className="text-xl font-semibold font-mono" style={{ color: rec.priorityScore >= 80 ? "var(--positive)" : "var(--foreground)" }}>
              {rec.priorityScore}
            </div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>组合适配</div>
            <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              {rec.portfolioFitScore}
            </div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>保证金效率</div>
            <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              {rec.marginEfficiencyScore}
            </div>
          </div>
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
        {rec.deferredUntil && (
          <>
            <span>·</span>
            <span>延后至 {formatRelativeTime(rec.deferredUntil)}</span>
          </>
        )}
        {rec.ignoredReason && (
          <>
            <span>·</span>
            <span>忽略原因：{rec.ignoredReason}</span>
          </>
        )}
      </div>

      {/* Actions */}
      {rec.status === "pending" && (
        <div className="flex gap-2 pt-4 mt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => { onConfirm?.(rec.id); }}
            className="flex-1 text-sm py-2.5 rounded-lg font-medium"
            style={{ background: "var(--positive)", color: "#fff" }}
          >
            确认执行
          </button>
          <button
            onClick={() => { onDefer?.(rec.id); }}
            className="text-sm px-4 py-2.5 rounded-lg"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            延后
          </button>
          <button
            onClick={() => {}}
            className="text-sm px-4 py-2.5 rounded-lg"
            style={{ background: "transparent", color: "var(--foreground-subtle)", border: "1px solid var(--border)" }}
          >
            忽略
          </button>
        </div>
      )}
    </div>
  );
}

const ALL_STATUSES: RecommendationStatus[] = [
  "pending",
  "confirmed",
  "deferred",
  "ignored",
  "backfilled",
  "expired",
];

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleConfirm(id: string) {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "confirmed" as RecommendationStatus } : r))
    );
  }

  function handleDefer(id: string) {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "deferred" as RecommendationStatus } : r))
    );
  }

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      return true;
    });
  }, [recommendations, statusFilter]);

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
              推荐与执行
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              共 {filtered.length} 条推荐
              {statusFilter.length > 0 && "（已筛选）"}
            </p>
          </div>
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
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
              没有符合条件的推荐
            </p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {filtered.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                onClick={() => openRec(rec.id)}
                onConfirm={handleConfirm}
                onDefer={handleDefer}
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
          <RecommendationDetail
            rec={selectedRec}
            onConfirm={handleConfirm}
            onDefer={handleDefer}
          />
        )}
      </Drawer>
    </div>
  );
}
