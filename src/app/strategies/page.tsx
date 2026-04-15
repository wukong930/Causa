"use client";

import { useState, useMemo } from "react";
import { mockStrategies } from "@/mocks/strategies";
import type { StrategyPoolItem, StrategyStatus } from "@/types/domain";
import {
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUS_BG,
} from "@/lib/constants";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";
import { StrategyDetail } from "@/components/strategies/StrategyDetail";

// ─── Filter pill ─────────────────────────────────────────────────────────────

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

// ─── Strategy Card ─────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  onClick,
}: {
  strategy: StrategyPoolItem;
  onClick: () => void;
}) {
  const h = strategy.hypothesis;
  const isUp = h.currentZScore > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border p-4 transition-colors hover:brightness-110"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate mb-0.5" style={{ color: "var(--foreground)" }}>
            {strategy.name}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-subtle)" }}>
            <span className="font-mono">{h.spreadModel.replace(/_/g, " ")}</span>
            <span>·</span>
            <span className="font-mono">{h.legs.map((l) => l.asset).join(" / ")}</span>
          </div>
        </div>
        <span
          className={clsx("text-xs font-medium px-2 py-0.5 rounded shrink-0", STRATEGY_STATUS_BG[strategy.status])}
          style={{
            color:
              strategy.status === "active"
                ? "var(--positive)"
                : strategy.status === "approaching_trigger"
                ? "var(--alert-high)"
                : "var(--foreground-muted)",
          }}
        >
          {STRATEGY_STATUS_LABEL[strategy.status]}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div
          className="rounded p-2 text-center"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>Z-Score</div>
          <div
            className="text-sm font-semibold font-mono"
            style={{ color: Math.abs(h.currentZScore) > 2 ? "var(--alert-critical)" : "var(--foreground)" }}
          >
            {h.currentZScore > 0 ? "+" : ""}{h.currentZScore.toFixed(2)}σ
          </div>
        </div>
        <div
          className="rounded p-2 text-center"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>命中率</div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {(strategy.validation.hitRate * 100).toFixed(0)}%
          </div>
        </div>
        <div
          className="rounded p-2 text-center"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>夏普</div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {strategy.validation.sharpeRatio?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>

      {/* Z-score bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
          <span>偏离程度</span>
          <span>
            触发阈值 {h.entryThreshold > 0 ? "+" : ""}{h.entryThreshold}σ
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(Math.abs(h.currentZScore) / 3 * 100, 100)}%`,
              background:
                Math.abs(h.currentZScore) > 2
                  ? "var(--alert-critical)"
                  : Math.abs(h.currentZScore) > 1.5
                  ? "var(--alert-high)"
                  : "var(--accent-blue)",
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>
        <span>置信度 {formatConfidence(h.causalConfidence ?? 0)}</span>
        <span className="ml-auto">更新 {formatRelativeTime(h.lastUpdated)}</span>
      </div>
    </button>
  );
}

// ─── Strategy Table Row ────────────────────────────────────────────────────

function StrategyTableRow({
  strategy,
  onClick,
}: {
  strategy: StrategyPoolItem;
  onClick: () => void;
}) {
  const h = strategy.hypothesis;
  return (
    <tr
      onClick={onClick}
      className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {strategy.name}
        </div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          {h.legs.map((l) => l.asset).join(" / ")}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background:
              strategy.status === "active"
                ? "var(--positive-muted)"
                : strategy.status === "approaching_trigger"
                ? "var(--alert-high-muted)"
                : "var(--surface-overlay)",
            color:
              strategy.status === "active"
                ? "var(--positive)"
                : strategy.status === "approaching_trigger"
                ? "var(--alert-high)"
                : "var(--foreground-muted)",
          }}
        >
          {STRATEGY_STATUS_LABEL[strategy.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className="text-sm font-mono font-medium"
          style={{ color: Math.abs(h.currentZScore) > 2 ? "var(--alert-critical)" : "var(--foreground)" }}
        >
          {h.currentZScore > 0 ? "+" : ""}{h.currentZScore.toFixed(2)}σ
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm" style={{ color: "var(--foreground)" }}>
          {(strategy.validation.hitRate * 100).toFixed(0)}%
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm" style={{ color: "var(--foreground)" }}>
          {strategy.validation.sharpeRatio?.toFixed(2) ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(h.lastUpdated)}
        </span>
      </td>
    </tr>
  );
}

// ─── Strategies Page ───────────────────────────────────────────────────────

const ALL_STATUSES: StrategyStatus[] = [
  "active",
  "approaching_trigger",
  "watch_only",
  "paused",
  "draft",
  "retired",
];

export default function StrategiesPage() {
  const [statusFilter, setStatusFilter] = useState<StrategyStatus[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return mockStrategies
      .filter((s) => {
        if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !s.name.toLowerCase().includes(q) &&
            !s.hypothesis.legs.some((l) => l.asset.toLowerCase().includes(q))
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<StrategyStatus, number> = {
          active: 0,
          approaching_trigger: 1,
          watch_only: 2,
          paused: 3,
          draft: 4,
          retired: 5,
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [statusFilter, search]);

  const selectedStrategy = selectedId
    ? mockStrategies.find((s) => s.id === selectedId)
    : null;

  function toggleStatus(s: StrategyStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function openStrategy(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  const counts = useMemo(() => {
    return ALL_STATUSES.reduce(
      (acc, s) => ({
        ...acc,
        [s]: mockStrategies.filter((x) => x.status === s).length,
      }),
      {} as Record<StrategyStatus, number>
    );
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ── */}
      <div
        className="px-5 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              策略池
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              共 {filtered.length} 条策略
              {(statusFilter.length > 0 || search) && "（已筛选）"}
            </p>
          </div>

          {/* Stats */}
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
                {counts[s]} {STRATEGY_STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded px-3 py-2 mb-3"
          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--foreground-subtle)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索策略名称、品种…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--foreground)" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "var(--foreground-subtle)" }}
            >
              ×
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs mr-1" style={{ color: "var(--foreground-subtle)" }}>状态：</span>
          {ALL_STATUSES.map((s) => (
            <FilterPill
              key={s}
              label={STRATEGY_STATUS_LABEL[s]}
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

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setViewMode("card")}
              className="p-1.5 rounded transition-colors"
              style={{
                background: viewMode === "card" ? "var(--surface-overlay)" : "transparent",
                color: viewMode === "card" ? "var(--foreground)" : "var(--foreground-subtle)",
              }}
              title="卡片视图"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className="p-1.5 rounded transition-colors"
              style={{
                background: viewMode === "table" ? "var(--surface-overlay)" : "transparent",
                color: viewMode === "table" ? "var(--foreground)" : "var(--foreground-subtle)",
              }}
              title="表格视图"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Strategy list ── */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
            <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
              没有符合条件的策略
            </p>
          </div>
        ) : viewMode === "card" ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onClick={() => openStrategy(strategy.id)}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg mx-5 mt-5 overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    策略
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    状态
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    Z-Score
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    命中率
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    夏普
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    更新
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((strategy) => (
                  <StrategyTableRow
                    key={strategy.id}
                    strategy={strategy}
                    onClick={() => openStrategy(strategy.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="策略详情"
        width="600px"
      >
        {selectedStrategy && (
          <StrategyDetail
            strategy={selectedStrategy}
          />
        )}
      </Drawer>
    </div>
  );
}
