"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAlerts, getStrategies, getRecommendations } from "@/lib/api-client";
import { getCommodityName, COMMODITY_NAME_MAP } from "@/lib/constants";
import Link from "next/link";
import type { Alert, StrategyPoolItem, Recommendation } from "@/types/domain";

interface SearchResult {
  type: "alert" | "strategy" | "recommendation" | "commodity";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function TopBar() {
  const router = useRouter();
  const [activeCount, setActiveCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [allStrategies, setAllStrategies] = useState<StrategyPoolItem[]>([]);
  const [allRecs, setAllRecs] = useState<Recommendation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAlerts().then((alerts) => {
      setAllAlerts(alerts);
      const active = alerts.filter((a) => a.status === "active");
      setActiveCount(active.length);
      setCriticalCount(active.filter((a) => a.severity === "critical").length);
    });
    getStrategies().then(setAllStrategies);
    getRecommendations().then(setAllRecs);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Search logic
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const lower = q.toLowerCase();
    const out: SearchResult[] = [];

    // Commodities
    for (const [code, name] of Object.entries(COMMODITY_NAME_MAP)) {
      if (code.toLowerCase().includes(lower) || name.includes(q)) {
        out.push({ type: "commodity", id: code, title: `${name} ${code}`, subtitle: "品种", href: `/alerts?category=${code}` });
      }
    }

    // Alerts
    for (const a of allAlerts) {
      if (a.title.toLowerCase().includes(lower) || a.summary.toLowerCase().includes(lower)) {
        out.push({ type: "alert", id: a.id, title: a.title, subtitle: `预警 · ${a.severity}`, href: `/alerts?selected=${a.id}` });
      }
    }

    // Strategies
    for (const s of allStrategies) {
      if (s.name.toLowerCase().includes(lower) || (s.description ?? "").toLowerCase().includes(lower)) {
        out.push({ type: "strategy", id: s.id, title: s.name, subtitle: "策略", href: `/strategies?selected=${s.id}` });
      }
    }

    // Recommendations
    for (const r of allRecs) {
      const legNames = r.legs.map((l) => getCommodityName(l.asset)).join("/");
      if (legNames.toLowerCase().includes(lower) || r.reasoning.toLowerCase().includes(lower)) {
        out.push({ type: "recommendation", id: r.id, title: legNames, subtitle: "建议", href: `/recommendations?selected=${r.id}` });
      }
    }

    setResults(out.slice(0, 10));
  }, [allAlerts, allStrategies, allRecs]);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  const TYPE_COLORS: Record<string, string> = {
    commodity: "var(--accent-blue)",
    alert: "var(--alert-high)",
    strategy: "var(--positive)",
    recommendation: "var(--alert-medium)",
  };

  return (
    <header
      className="hidden md:flex items-center gap-4 px-6 border-b shrink-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)", height: "var(--topnav-height)" }}
    >
      {/* Search */}
      <div ref={containerRef} className="relative flex-1 max-w-xs">
        <div
          className="flex items-center gap-2 rounded px-3 py-1.5 text-sm cursor-text"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {open ? (
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--foreground)" }}
              placeholder="搜索品种、预警、策略…"
            />
          ) : (
            <span style={{ color: "var(--foreground-subtle)" }}>搜索品种、预警、策略…</span>
          )}
          <kbd className="ml-auto text-xs px-1 rounded" style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)", border: "1px solid var(--border)" }}>⌘K</kbd>
        </div>

        {/* Dropdown */}
        {open && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden z-50" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>无匹配结果</div>
            ) : results.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={r.href}
                onClick={() => { setOpen(false); setQuery(""); }}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle, var(--border))" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-overlay)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: `${TYPE_COLORS[r.type]}20`, color: TYPE_COLORS[r.type] }}>{r.subtitle}</span>
                <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{r.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded text-xs font-medium" style={{ background: "var(--alert-critical-muted)", color: "var(--alert-critical)", border: "1px solid var(--alert-critical)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--alert-critical)" }} />
            {criticalCount} 极高预警
          </div>
        )}

        <select className="text-xs rounded px-2 py-1 outline-none" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}>
          <option>过去 1 小时</option>
          <option>过去 4 小时</option>
          <option>今日</option>
          <option>过去 3 天</option>
          <option>过去 1 周</option>
        </select>

        <select className="text-xs rounded px-2 py-1 outline-none" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}>
          <option>全部市场</option>
          <option>黑色</option>
          <option>有色</option>
          <option>能化</option>
          <option>农产品</option>
          <option>海外</option>
        </select>

        <button
          onClick={() => router.push("/alerts")}
          className="relative p-1.5 rounded transition-colors"
          style={{ color: "var(--foreground-muted)" }}
          title={activeCount > 0 ? `${activeCount} 条活跃预警` : "暂无预警"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {activeCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: "var(--alert-critical)" }} />
          )}
        </button>
      </div>
    </header>
  );
}
