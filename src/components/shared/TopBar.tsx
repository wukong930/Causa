"use client";

import { useState, useEffect } from "react";
import { getAlerts } from "@/lib/api-client";

export function TopBar() {
  const [activeCount, setActiveCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    getAlerts().then((alerts) => {
      const active = alerts.filter((a) => a.status === "active");
      setActiveCount(active.length);
      setCriticalCount(active.filter((a) => a.severity === "critical").length);
    });
  }, []);

  return (
    <header
      className="hidden md:flex items-center gap-4 px-6 border-b shrink-0"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        height: "var(--topnav-height)",
      }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2 flex-1 max-w-xs rounded px-3 py-1.5 text-sm"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span style={{ color: "var(--foreground-subtle)" }}>搜索品种、预警、策略…</span>
        <kbd
          className="ml-auto text-xs px-1 rounded"
          style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)", border: "1px solid var(--border)" }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Alert status */}
        {criticalCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded text-xs font-medium"
            style={{ background: "var(--alert-critical-muted)", color: "var(--alert-critical)", border: "1px solid var(--alert-critical)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--alert-critical)" }} />
            {criticalCount} 极高预警
          </div>
        )}

        {/* Time window */}
        <select
          className="text-xs rounded px-2 py-1 outline-none"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <option>过去 1 小时</option>
          <option>过去 4 小时</option>
          <option selected>今日</option>
          <option>过去 3 天</option>
          <option>过去 1 周</option>
        </select>

        {/* Market selector */}
        <select
          className="text-xs rounded px-2 py-1 outline-none"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <option>全部市场</option>
          <option>黑色</option>
          <option>有色</option>
          <option>能化</option>
          <option>农产品</option>
          <option>海外</option>
        </select>

        {/* Notification bell */}
        <button
          className="relative p-1.5 rounded transition-colors"
          style={{ color: "var(--foreground-muted)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {activeCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
              style={{ background: "var(--alert-critical)" }}
            />
          )}
        </button>
      </div>
    </header>
  );
}
