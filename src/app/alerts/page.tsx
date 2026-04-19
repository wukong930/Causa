"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Alert, AlertSeverity, AlertCategory } from "@/types/domain";
import { getAlerts } from "@/lib/api-client";
import { SeverityBadge, CategoryBadge } from "@/components/shared/Badges";
import { Drawer } from "@/components/shared/Drawer";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import { SEVERITY_LABEL, CATEGORY_LABEL, getCommodityName } from "@/lib/constants";
import { useAlertStream } from "@/hooks/use-alert-stream";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { RefreshBar } from "@/components/shared/RefreshBar";

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
                {getCommodityName(a)}
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
  return (
    <Suspense>
      <AlertsPageInner />
    </Suspense>
  );
}

function AlertsPageInner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const searchParams = useSearchParams();

  // Auto-open drawer from ?id= query param
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && alerts.length > 0) {
      setSelectedId(id);
      setDrawerOpen(true);
    }
  }, [searchParams, alerts]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [lastStreamedAt, setLastStreamedAt] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    const data = await getAlerts();
    setAlerts(data);
    setLoading(false);
  }, []);

  const { refresh, isRefreshing, interval: refreshInterval, setInterval: setRefreshInterval, lastRefreshed } = useAutoRefresh(fetchAlerts);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  // Handle new alerts from SSE stream
  const handleNewAlerts = useCallback((newAlerts: Alert[]) => {
    setAlerts((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const unique = newAlerts.filter((a) => !existingIds.has(a.id));
      if (unique.length === 0) return prev;
      return [...unique, ...prev];
    });
    setNewAlertCount((c) => c + newAlerts.length);
    setLastStreamedAt(new Date());
  }, []);

  // Subscribe to real-time alert stream
  useAlertStream({
    onAlerts: handleNewAlerts,
    onConnect: () => setStreamConnected(true),
    onDisconnect: () => setStreamConnected(false),
    enabled: !loading,
  });

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => {
        // Tab filter
        if (activeTab === "current" && a.status !== "active") return false;
        if (activeTab === "history" && a.status === "active") return false;
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
  }, [alerts, severityFilter, categoryFilter, search, activeTab]);

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
          <RefreshBar
            isRefreshing={isRefreshing}
            interval={refreshInterval}
            lastRefreshed={lastRefreshed}
            onRefresh={refresh}
            onIntervalChange={setRefreshInterval}
          />

          {/* Stream status + Trigger button + Stats badges */}
          <div className="flex items-center gap-3">
            {/* New alerts banner */}
            {newAlertCount > 0 && (
              <button
                onClick={() => setNewAlertCount(0)}
                className="text-xs px-3 py-1.5 rounded font-medium animate-pulse"
                style={{
                  background: "var(--accent-green)",
                  color: "#fff",
                }}
                title="点击消除"
              >
                +{newAlertCount} 新预警
              </button>
            )}
            {/* Stream status dot */}
            <div className="flex items-center gap-1.5" title={streamConnected ? "实时推送已连接" : "实时推送未连接"}>
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: streamConnected ? "#22c55e" : "var(--foreground-subtle)",
                  boxShadow: streamConnected ? "0 0 6px #22c55e" : "none",
                }}
              />
            </div>
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

        {/* Tab switcher */}
        <div className="flex gap-1 mb-3 rounded-lg p-0.5" style={{ background: "var(--surface-overlay)" }}>
          {([["current", "当前预警"], ["history", "历史预警"]] as const).map(([key, label]) => (
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
          <AlertDetail alert={selectedAlert} />
        )}
      </Drawer>
    </div>
  );
}
