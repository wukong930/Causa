"use client";

import { useState, useMemo, useEffect } from "react";
import type { Alert, AlertSeverity, AlertCategory, AlertType } from "@/types/domain";
import { getAlerts, triggerAlerts } from "@/lib/api-client";
import { SeverityBadge, CategoryBadge } from "@/components/shared/Badges";
import { Drawer } from "@/components/shared/Drawer";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import { SEVERITY_LABEL, CATEGORY_LABEL } from "@/lib/constants";

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

// ─── Alert list row ───────────────────────────────────────────────────────────

function AlertRow({
  alert,
  selected,
  onClick,
}: {
  alert: Alert;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b transition-colors block"
      style={{
        borderColor: "var(--border-subtle)",
        background: selected ? "var(--surface-raised)" : "transparent",
      }}
    >
      <div className="px-5 py-4">
        {/* Top row */}
        <div className="flex items-center gap-2 mb-2">
          <SeverityBadge severity={alert.severity} />
          <CategoryBadge category={alert.category} />
          <span className="ml-auto text-xs shrink-0" style={{ color: "var(--foreground-subtle)" }}>
            {formatRelativeTime(alert.triggeredAt)}
          </span>
        </div>

        {/* Title */}
        <div
          className="text-sm font-medium mb-1 leading-snug"
          style={{ color: "var(--foreground)" }}
        >
          {alert.title}
        </div>

        {/* Summary — truncated */}
        <div
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--foreground-muted)" }}
        >
          {alert.summary}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex gap-1.5">
            {alert.relatedAssets.slice(0, 3).map((a) => (
              <span
                key={a}
                className="text-xs font-mono"
                style={{ color: "var(--accent-blue)" }}
              >
                {a}
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs" style={{ color: "var(--foreground-subtle)" }}>
            置信度 {formatConfidence(alert.confidence)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Alerts Page ─────────────────────────────────────────────────────────────

const ALL_SEVERITIES: AlertSeverity[] = ["critical", "high", "medium", "low"];
const ALL_CATEGORIES: AlertCategory[] = ["ferrous", "nonferrous", "energy", "agriculture", "overseas"];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAlerts().then((data) => {
      setAlerts(data);
      setLoading(false);
    });
  }, []);

  async function refreshAlerts() {
    const data = await getAlerts();
    setAlerts(data);
  }

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => {
        if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) return false;
        if (categoryFilter.length > 0 && !categoryFilter.includes(a.category)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !a.title.toLowerCase().includes(q) &&
            !a.summary.toLowerCase().includes(q) &&
            !a.relatedAssets.some((x) => x.toLowerCase().includes(q))
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      });
  }, [alerts, severityFilter, categoryFilter, search]);

  const selectedAlert = selectedId ? alerts.find((a) => a.id === selectedId) : null;

  function toggleSeverity(s: AlertSeverity) {
    setSeverityFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function toggleCategory(c: AlertCategory) {
    setCategoryFilter((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function openAlert(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  async function handleTrigger(symbol1: string, symbol2: string, category: AlertCategory) {
    setTriggering(true);
    try {
      const result = await triggerAlerts({
        symbol1,
        symbol2: symbol2 || undefined,
        category,
        window: 20,
      });
      if (result) {
        await refreshAlerts();
        setTriggerDialogOpen(false);
        alert(`触发成功：生成 ${result.alerts.length} 条预警，${result.recommendations.length} 条推荐`);
      } else {
        alert("触发失败，请检查市场数据");
      }
    } catch (err) {
      console.error("Trigger error:", err);
      alert("触发失败");
    } finally {
      setTriggering(false);
    }
  }

  // Counts per severity for the stats bar
  const counts = useMemo(() => {
    return ALL_SEVERITIES.reduce(
      (acc, s) => ({ ...acc, [s]: alerts.filter((a) => a.severity === s && a.status === "active").length }),
      {} as Record<AlertSeverity, number>
    );
  }, [alerts]);

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
              预警
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              共 {filtered.length} 条预警
              {(severityFilter.length > 0 || categoryFilter.length > 0 || search) && "（已筛选）"}
            </p>
          </div>

          {/* Trigger button + Stats badges */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTriggerDialogOpen(true)}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                background: "var(--accent-blue)",
                color: "#fff",
              }}
            >
              手动触发
            </button>
            <div className="flex items-center gap-2">
              {ALL_SEVERITIES.map((s) => (
                counts[s] > 0 ? (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{
                      background:
                        s === "critical" ? "var(--alert-critical-muted)" :
                        s === "high" ? "var(--alert-high-muted)" :
                        s === "medium" ? "var(--alert-medium-muted)" :
                        "var(--alert-low-muted)",
                      color:
                        s === "critical" ? "var(--alert-critical)" :
                        s === "high" ? "var(--alert-high)" :
                        s === "medium" ? "var(--alert-medium)" :
                        "var(--alert-low)",
                    }}
                  >
                    {counts[s]} {SEVERITY_LABEL[s]}
                  </span>
                ) : null
              ))}
            </div>
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
            placeholder="搜索品种、预警标题…"
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

        {/* Severity filter */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs mr-1" style={{ color: "var(--foreground-subtle)" }}>严重度：</span>
          {ALL_SEVERITIES.map((s) => (
            <FilterPill
              key={s}
              label={SEVERITY_LABEL[s]}
              active={severityFilter.includes(s)}
              onClick={() => toggleSeverity(s)}
            />
          ))}
          {severityFilter.length > 0 && (
            <button
              className="text-xs px-2"
              style={{ color: "var(--foreground-subtle)" }}
              onClick={() => setSeverityFilter([])}
            >
              清除
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs mr-1" style={{ color: "var(--foreground-subtle)" }}>品类：</span>
          {ALL_CATEGORIES.map((c) => (
            <FilterPill
              key={c}
              label={CATEGORY_LABEL[c]}
              active={categoryFilter.includes(c)}
              onClick={() => toggleCategory(c)}
            />
          ))}
          {categoryFilter.length > 0 && (
            <button
              className="text-xs px-2"
              style={{ color: "var(--foreground-subtle)" }}
              onClick={() => setCategoryFilter([])}
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* ── Alert list ── */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="px-5 py-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-16 rounded" style={{ background: "var(--surface-overlay)" }} />
                    <div className="h-5 w-20 rounded" style={{ background: "var(--surface-overlay)" }} />
                  </div>
                  <div className="h-4 w-2/3 rounded mb-1" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-3 w-full rounded mb-2" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-3 w-3/4 rounded" style={{ background: "var(--surface-overlay)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
              没有符合条件的预警
            </p>
          </div>
        ) : (
          filtered.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              selected={alert.id === selectedId}
              onClick={() => openAlert(alert.id)}
            />
          ))
        )}
      </div>

      {/* ── Detail drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="预警详情"
        width="600px"
      >
        {selectedAlert && (
          <AlertDetail
            alert={selectedAlert}
            onAddToWatch={() => {/* TODO */}}
            onMoveToStrategy={() => {/* TODO */}}
            onInvalidate={() => setDrawerOpen(false)}
          />
        )}
      </Drawer>

      {/* ── Trigger dialog ── */}
      {triggerDialogOpen && (
        <TriggerDialog
          open={triggerDialogOpen}
          onClose={() => setTriggerDialogOpen(false)}
          onTrigger={handleTrigger}
          triggering={triggering}
        />
      )}
    </div>
  );
}

// ─── Trigger Dialog ──────────────────────────────────────────────────────────

function TriggerDialog({
  open,
  onClose,
  onTrigger,
  triggering,
}: {
  open: boolean;
  onClose: () => void;
  onTrigger: (symbol1: string, symbol2: string, category: AlertCategory) => void;
  triggering: boolean;
}) {
  const [symbol1, setSymbol1] = useState("RB2506");
  const [symbol2, setSymbol2] = useState("HC2506");
  const [category, setCategory] = useState<AlertCategory>("ferrous");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 w-[480px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          手动触发预警
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--foreground-subtle)" }}>
              合约 1（必填）
            </label>
            <input
              type="text"
              value={symbol1}
              onChange={(e) => setSymbol1(e.target.value)}
              placeholder="例如：RB2506"
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--foreground-subtle)" }}>
              合约 2（可选，用于价差检测）
            </label>
            <input
              type="text"
              value={symbol2}
              onChange={(e) => setSymbol2(e.target.value)}
              placeholder="例如：HC2506"
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--foreground-subtle)" }}>
              品类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AlertCategory)}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="ferrous">黑色</option>
              <option value="nonferrous">有色</option>
              <option value="energy">能化</option>
              <option value="agriculture">农产品</option>
              <option value="overseas">海外</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={() => onTrigger(symbol1, symbol2, category)}
            disabled={!symbol1 || triggering}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--accent-blue)",
              color: "#fff",
            }}
          >
            {triggering ? "触发中..." : "触发"}
          </button>
          <button
            onClick={onClose}
            disabled={triggering}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              background: "var(--surface-overlay)",
              color: "var(--foreground-muted)",
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
