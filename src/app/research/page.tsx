"use client";

import { useState, useMemo, useEffect } from "react";
import type { ResearchReport, ResearchHypothesis } from "@/types/domain";
import { getResearchReports, getHypotheses, updateHypothesis, getGDELTEvents, getMacroIndicators } from "@/lib/api-client";
import type { GDELTEvent, MacroSnapshot } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

// ─── Hypothesis status config ─────────────────────────────────────────────────

const HYP_STATUS: Record<ResearchHypothesis["status"], { label: string; bg: string; color: string }> = {
  validated:   { label: "已验证", bg: "var(--positive-muted)",          color: "var(--positive)" },
  monitoring:  { label: "观察中", bg: "var(--alert-medium-muted)",      color: "var(--alert-medium)" },
  new:         { label: "新建",   bg: "var(--surface-overlay)",         color: "var(--foreground-muted)" },
  invalidated: { label: "已失效", bg: "var(--surface-overlay)",         color: "var(--foreground-subtle)" },
};

// ─── Hypothesis Card ──────────────────────────────────────────────────────────

function HypothesisCard({ hyp, onStatusChange }: { hyp: ResearchHypothesis; onStatusChange: (id: string, status: ResearchHypothesis["status"]) => void }) {
  const cfg = HYP_STATUS[hyp.status];

  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        opacity: hyp.status === "invalidated" ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3
          className="text-sm font-medium leading-snug"
          style={{
            color: hyp.status === "invalidated" ? "var(--foreground-subtle)" : "var(--foreground)",
            textDecoration: hyp.status === "invalidated" ? "line-through" : "none",
          }}
        >
          {hyp.title}
        </h3>
        <select
          value={hyp.status}
          onChange={(e) => onStatusChange(hyp.id, e.target.value as ResearchHypothesis["status"])}
          className="text-xs px-2 py-0.5 rounded-full shrink-0 cursor-pointer"
          style={{ background: cfg.bg, color: cfg.color, border: "none", appearance: "auto" }}
        >
          <option value="new">新建</option>
          <option value="monitoring">观察中</option>
          <option value="validated">已验证</option>
          <option value="invalidated">已失效</option>
        </select>
      </div>

      <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--foreground-muted)" }}>
        {hyp.description}
      </p>

      <div className="flex items-center gap-3">
        {/* Confidence bar */}
        <div className="flex items-center gap-2 flex-1">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: "3px", background: "var(--surface-overlay)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(hyp.confidence * 100)}%`,
                background:
                  hyp.confidence >= 0.8 ? "var(--positive)" :
                  hyp.confidence >= 0.6 ? "var(--accent-primary)" :
                  "var(--alert-high)",
              }}
            />
          </div>
          <span
            className="text-xs font-mono shrink-0"
            style={{ color: "var(--foreground-subtle)" }}
          >
            {Math.round(hyp.confidence * 100)}%
          </span>
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(hyp.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Report Viewer ────────────────────────────────────────────────────────────

function CollapsibleJSON({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  let formatted = content;
  try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch { /* keep raw */ }

  return (
    <div className="rounded-lg border mb-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium"
        style={{ color: "var(--foreground-muted)" }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
        查看原始数据
      </button>
      {open && (
        <pre className="px-3 pb-3 text-xs overflow-x-auto font-mono leading-relaxed" style={{ color: "var(--foreground-subtle)", maxHeight: 400 }}>
          {formatted}
        </pre>
      )}
    </div>
  );
}

function generateReportPlainSummary(body: string): string | null {
  try {
    const data = JSON.parse(body);
    if (data.alertsProcessed != null) {
      const parts = [];
      parts.push(`本轮分析处理了 ${data.alertsProcessed} 条预警信号`);
      if (data.hypothesesGenerated) parts.push(`生成了 ${data.hypothesesGenerated} 个交易假设`);
      if (data.hypothesesSelected) parts.push(`其中 ${data.hypothesesSelected} 个通过筛选`);
      if (data.avgScore) parts.push(`平均得分 ${data.avgScore.toFixed(1)} 分`);
      if (data.selected?.length) {
        const top = data.selected.slice(0, 3).map((s: { text: string; score: number }) =>
          `${s.text.slice(0, 50)}（${(s.score * 100).toFixed(0)}分）`
        );
        parts.push(`重点关注：${top.join("；")}`);
      }
      return parts.join("，") + "。";
    }
  } catch { /* not JSON */ }
  return null;
}

function ReportViewer({ report }: { report: ResearchReport }) {
  // Simple markdown-ish renderer: bold and paragraphs
  const lines = report.body.split("\n\n");
  const plainSummary = generateReportPlainSummary(report.body);

  return (
    <div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--foreground-muted)" }}>
        {report.summary}
      </p>

      {/* Plain summary for JSON-heavy reports */}
      {plainSummary && (
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-primary)" }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            <span className="text-xs font-semibold" style={{ color: "var(--accent-primary)" }}>通俗解读</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            <span className="block font-semibold mb-1">
              {report.summary.split(/[。！？]/)[0]}。
            </span>
            {plainSummary}
          </p>
        </div>
      )}

      <div
        className="rounded-lg p-5 border"
        style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
      >
        {lines.map((block, i) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // Detect JSON blocks and make them collapsible
          if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            return <CollapsibleJSON key={i} content={trimmed} />;
          }

          // Bold heading lines like **黑色**：...
          const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);

          return (
            <p
              key={i}
              className="text-sm leading-relaxed mb-3 last:mb-0"
              style={{ color: "var(--foreground-muted)" }}
            >
              {parts.map((part, j) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={j} style={{ color: "var(--foreground)" }}>
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={j}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>
        <span>
          关联预警 {report.relatedAlertIds.length} 条
        </span>
        <span>
          关联策略 {report.relatedStrategyIds.length} 个
        </span>
        <span className="ml-auto">
          发布于 {formatRelativeTime(report.publishedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Research Page ────────────────────────────────────────────────────────────

const REPORT_TYPE_LABEL: Record<string, string> = {
  daily: "日报",
  weekly: "周报",
};

export default function ResearchPage() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [hypotheses, setHypotheses] = useState<ResearchHypothesis[]>([]);
  const [gdeltEvents, setGdeltEvents] = useState<GDELTEvent[]>([]);
  const [macroSnapshot, setMacroSnapshot] = useState<MacroSnapshot | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [hypFilter, setHypFilter] = useState<ResearchHypothesis["status"] | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getResearchReports(),
      getHypotheses(),
      getGDELTEvents(),
      getMacroIndicators(),
    ]).then(([r, h, ge, mi]) => {
      setReports(r);
      setHypotheses(h);
      setGdeltEvents(ge ?? []);
      setMacroSnapshot(mi);
      setActiveReportId(r[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const activeReport = reports.find((r) => r.id === activeReportId) ?? null;

  const filteredHypotheses = hypFilter === "all"
    ? hypotheses
    : hypotheses.filter((h) => h.status === hypFilter);

  function handleHypStatusChange(id: string, status: ResearchHypothesis["status"]) {
    setHypotheses((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
    updateHypothesis(id, { status });
  }

  const HYP_FILTERS: Array<{ value: ResearchHypothesis["status"] | "all"; label: string }> = [
    { value: "all",         label: "全部" },
    { value: "validated",   label: "已验证" },
    { value: "monitoring",  label: "观察中" },
    { value: "new",         label: "新建" },
    { value: "invalidated", label: "已失效" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          研究
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          研究报告 · Hypothesis 跟踪
        </p>
      </div>

      {/* Content — two-column on lg */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
            <div>
              <div className="h-6 w-48 rounded mb-3" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-4 w-full rounded mb-2" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-4 w-4/5 rounded mb-2" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-4 w-3/5 rounded mb-6" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-32 rounded-lg" style={{ background: "var(--surface-overlay)" }} />
            </div>
            <div>
              <div className="h-5 w-32 rounded mb-3" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-20 rounded-lg mb-3" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-20 rounded-lg mb-3" style={{ background: "var(--surface-overlay)" }} />
              <div className="h-20 rounded-lg" style={{ background: "var(--surface-overlay)" }} />
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">

          {/* Left — Reports */}
          <div>
            {/* Report tabs */}
            <div
              className="flex gap-1 mb-4 p-1 rounded-lg"
              style={{ background: "var(--surface-overlay)", width: "fit-content" }}
            >
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveReportId(r.id)}
                  className="text-xs px-3 py-1.5 rounded-md transition-colors"
                  style={{
                    background: activeReportId === r.id ? "var(--surface)" : "transparent",
                    color: activeReportId === r.id ? "var(--foreground)" : "var(--foreground-muted)",
                    boxShadow: activeReportId === r.id ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {REPORT_TYPE_LABEL[r.type] ?? r.type} · {r.publishedAt.slice(0, 10)}
                </button>
              ))}
            </div>

            {activeReport && (
              <div>
                <h2
                  className="text-base font-semibold mb-3"
                  style={{ color: "var(--foreground)" }}
                >
                  {activeReport.title}
                </h2>
                <ReportViewer report={activeReport} />
              </div>
            )}
          </div>

          {/* Right — Hypotheses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Hypothesis 跟踪
              </h2>
              <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {filteredHypotheses.length} 条
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1 flex-wrap mb-4">
              {HYP_FILTERS.map((f) => {
                const active = hypFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setHypFilter(f.value)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                    style={{
                      background: active ? "var(--accent-primary)" : "var(--surface)",
                      color: active ? "#fff" : "var(--foreground-muted)",
                      borderColor: active ? "var(--accent-primary)" : "var(--border)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {filteredHypotheses.map((hyp) => (
                <HypothesisCard key={hyp.id} hyp={hyp} onStatusChange={handleHypStatusChange} />
              ))}
            </div>

            {/* GDELT Events */}
            {gdeltEvents.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  近期事件
                </h2>
                <div className="flex flex-col gap-2">
                  {gdeltEvents.slice(0, 5).map((ev, i) => (
                    <a
                      key={i}
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-3 border block transition-colors hover:brightness-110"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <div className="text-xs font-medium leading-snug mb-1" style={{ color: "var(--foreground)" }}>
                        {ev.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-subtle)" }}>
                        <span>{ev.domain}</span>
                        <span>·</span>
                        <span>{ev.seenDate?.slice(0, 10)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Macro Indicators */}
            {macroSnapshot && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  宏观指标
                </h2>
                <div className="rounded-lg p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { label: "美元指数", value: macroSnapshot.usdIndex },
                      { label: "联邦基金利率", value: macroSnapshot.fedFundsRate, suffix: "%" },
                      { label: "CPI (YoY)", value: macroSnapshot.cpiYoY, suffix: "%" },
                      { label: "PMI 制造业", value: macroSnapshot.pmiManufacturing },
                      { label: "美10Y", value: macroSnapshot.us10yYield, suffix: "%" },
                      { label: "中10Y", value: macroSnapshot.cn10yYield, suffix: "%" },
                      { label: "Brent 原油", value: macroSnapshot.crudeBrent, prefix: "$" },
                      { label: "黄金", value: macroSnapshot.goldSpot, prefix: "$" },
                      { label: "LME 铜", value: macroSnapshot.copperLME, prefix: "$" },
                      { label: "铁矿石 62%", value: macroSnapshot.ironOre62Fe, prefix: "$" },
                      { label: "BDI", value: macroSnapshot.balticDryIndex },
                    ].filter((m) => m.value != null).map((m) => (
                      <div key={m.label}>
                        <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>{m.label}</div>
                        <div className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
                          {m.prefix ?? ""}{typeof m.value === "number" ? m.value.toLocaleString() : m.value}{m.suffix ?? ""}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs mt-3 pt-2 border-t" style={{ borderColor: "var(--border-subtle)", color: "var(--foreground-subtle)" }}>
                    数据来源：{macroSnapshot.source} · {macroSnapshot.fetchedAt?.slice(0, 10)} · 数据为最近发布值，非实时行情
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
