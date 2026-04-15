"use client";

import { useState } from "react";
import { mockReports, mockHypotheses } from "@/lib/mockData";
import type { ResearchReport, Hypothesis } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";

// ─── Hypothesis status config ─────────────────────────────────────────────────

const HYP_STATUS: Record<Hypothesis["status"], { label: string; bg: string; color: string }> = {
  validated:   { label: "已验证", bg: "var(--positive-muted)",          color: "var(--positive)" },
  monitoring:  { label: "观察中", bg: "var(--alert-medium-muted)",      color: "var(--alert-medium)" },
  new:         { label: "新建",   bg: "var(--surface-overlay)",         color: "var(--foreground-muted)" },
  invalidated: { label: "已失效", bg: "var(--surface-overlay)",         color: "var(--foreground-subtle)" },
};

// ─── Hypothesis Card ──────────────────────────────────────────────────────────

function HypothesisCard({ hyp }: { hyp: Hypothesis }) {
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
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
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
                  hyp.confidence >= 0.6 ? "var(--accent-blue)" :
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

function ReportViewer({ report }: { report: ResearchReport }) {
  // Simple markdown-ish renderer: bold and paragraphs
  const lines = report.body.split("\n\n");

  return (
    <div>
      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--foreground-muted)" }}>
        {report.summary}
      </p>
      <div
        className="rounded-lg p-5 border"
        style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
      >
        {lines.map((block, i) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

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
  const [activeReportId, setActiveReportId] = useState(mockReports[0]?.id ?? null);
  const [hypFilter, setHypFilter] = useState<Hypothesis["status"] | "all">("all");

  const activeReport = mockReports.find((r) => r.id === activeReportId) ?? null;

  const filteredHypotheses = hypFilter === "all"
    ? mockHypotheses
    : mockHypotheses.filter((h) => h.status === hypFilter);

  const HYP_FILTERS: Array<{ value: Hypothesis["status"] | "all"; label: string }> = [
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
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">

          {/* Left — Reports */}
          <div>
            {/* Report tabs */}
            <div
              className="flex gap-1 mb-4 p-1 rounded-lg"
              style={{ background: "var(--surface-overlay)", width: "fit-content" }}
            >
              {mockReports.map((r) => (
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
                      background: active ? "var(--accent-blue)" : "var(--surface)",
                      color: active ? "#fff" : "var(--foreground-muted)",
                      borderColor: active ? "var(--accent-blue)" : "var(--border)",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {filteredHypotheses.map((hyp) => (
                <HypothesisCard key={hyp.id} hyp={hyp} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
