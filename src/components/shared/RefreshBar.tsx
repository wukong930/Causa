"use client";

import type { RefreshInterval } from "@/hooks/use-auto-refresh";

const INTERVAL_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 0, label: "关闭" },
  { value: 30, label: "30秒" },
  { value: 60, label: "1分钟" },
  { value: 300, label: "5分钟" },
];

interface RefreshBarProps {
  isRefreshing: boolean;
  interval: RefreshInterval;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  onIntervalChange: (v: RefreshInterval) => void;
}

export function RefreshBar({ isRefreshing, interval, lastRefreshed, onRefresh, onIntervalChange }: RefreshBarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
        title="刷新数据"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={isRefreshing ? "animate-spin" : ""}
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        刷新
      </button>
      <select
        value={interval}
        onChange={(e) => onIntervalChange(Number(e.target.value) as RefreshInterval)}
        className="text-xs px-2 py-1.5 rounded-lg"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
      >
        {INTERVAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === 0 ? "自动刷新: 关闭" : `自动: ${o.label}`}
          </option>
        ))}
      </select>
      {lastRefreshed && (
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {lastRefreshed.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}
