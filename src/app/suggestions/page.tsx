"use client";

import { useState } from "react";
import { mockSuggestions } from "@/lib/mockData";
import type { Suggestion, SuggestionStatus } from "@/types/domain";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";

// ─── Liquidity Bar ────────────────────────────────────────────────────────────

function LiquidityBar({ value }: { value: number }) {
  const color =
    value >= 0.8 ? "var(--positive)" :
    value >= 0.6 ? "var(--accent-blue)" :
    "var(--alert-high)";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: "4px", background: "var(--surface-overlay)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.round(value * 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono shrink-0" style={{ color }}>
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, onAction }: {
  suggestion: Suggestion;
  onAction: (id: string, action: SuggestionStatus) => void;
}) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  function toggleCheck(i: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const allChecked = checkedItems.size === suggestion.confirmationChecklist.length;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Card header */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div
            className="text-base font-semibold font-mono"
            style={{ color: "var(--accent-blue)" }}
          >
            {suggestion.expression}
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "var(--alert-medium-muted)", color: "var(--alert-medium)" }}
          >
            待确认
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          生成于 {formatRelativeTime(suggestion.createdAt)}
        </p>
      </div>

      <div className="p-5">
        {/* Leg details */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[suggestion.leg1, suggestion.leg2].filter(Boolean).map((leg, i) => leg && (
            <div
              key={i}
              className="rounded-lg p-3"
              style={{
                background: "var(--surface-overlay)",
                border: `1px solid ${leg.direction === "long" ? "color-mix(in srgb, var(--positive) 30%, transparent)" : "color-mix(in srgb, var(--negative) 30%, transparent)"}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded uppercase"
                  style={{
                    background: leg.direction === "long" ? "var(--positive-muted)" : "var(--alert-critical-muted)",
                    color: leg.direction === "long" ? "var(--positive)" : "var(--alert-critical)",
                  }}
                >
                  {leg.direction === "long" ? "做多" : "做空"}
                </span>
                <span
                  className="text-sm font-mono font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {leg.asset}
                </span>
              </div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
                {leg.contract}
              </div>
              {leg.targetSize && (
                <div className="text-xs font-mono" style={{ color: "var(--foreground-subtle)" }}>
                  {leg.targetSize} {leg.unit}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Scores row */}
        <div
          className="rounded-lg p-4 grid grid-cols-3 gap-4 mb-5"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>置信度</div>
            <div
              className="text-xl font-semibold font-mono"
              style={{
                color:
                  suggestion.confidence >= 0.8 ? "var(--positive)" :
                  suggestion.confidence >= 0.6 ? "var(--accent-blue)" :
                  "var(--alert-high)",
              }}
            >
              {formatConfidence(suggestion.confidence)}
            </div>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>流动性</div>
            <div className="mt-2">
              <LiquidityBar value={suggestion.liquidityScore} />
            </div>
          </div>
          <div>
            <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>执行窗口</div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
              {suggestion.executionWindow}
            </div>
          </div>
        </div>

        {/* Key risks */}
        {suggestion.keyRisks.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
              关键风险
            </h4>
            <div
              className="rounded-lg px-3"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              {suggestion.keyRisks.map((r) => (
                <div
                  key={r}
                  className="flex items-center gap-2 py-2.5 border-b last:border-b-0 text-sm"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--foreground-muted)" }}
                >
                  <span style={{ color: "var(--alert-high)" }}>▲</span>
                  {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation checklist */}
        {suggestion.confirmationChecklist.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-subtle)" }}>
                人工确认清单
              </h4>
              <span className="text-xs" style={{ color: allChecked ? "var(--positive)" : "var(--foreground-subtle)" }}>
                {checkedItems.size}/{suggestion.confirmationChecklist.length} 已确认
              </span>
            </div>
            <div
              className="rounded-lg px-3"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              {suggestion.confirmationChecklist.map((item, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2.5 py-2.5 border-b last:border-b-0 cursor-pointer"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <input
                    type="checkbox"
                    checked={checkedItems.has(i)}
                    onChange={() => toggleCheck(i)}
                    className="mt-0.5 shrink-0 accent-[var(--accent-blue)]"
                  />
                  <span
                    className="text-sm"
                    style={{
                      color: checkedItems.has(i) ? "var(--foreground-subtle)" : "var(--foreground-muted)",
                      textDecoration: checkedItems.has(i) ? "line-through" : "none",
                    }}
                  >
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => onAction(suggestion.id, "confirmed")}
            disabled={!allChecked}
            className="flex-1 text-sm py-2.5 rounded-lg font-medium transition-opacity"
            style={{
              background: allChecked ? "var(--positive)" : "var(--surface-overlay)",
              color: allChecked ? "#fff" : "var(--foreground-subtle)",
              cursor: allChecked ? "pointer" : "not-allowed",
              opacity: allChecked ? 1 : 0.6,
            }}
          >
            确认执行
          </button>
          <button
            onClick={() => onAction(suggestion.id, "deferred")}
            className="text-sm px-4 py-2.5 rounded-lg transition-colors"
            style={{
              background: "var(--surface-overlay)",
              color: "var(--foreground-muted)",
              border: "1px solid var(--border)",
            }}
          >
            延后
          </button>
          <button
            onClick={() => onAction(suggestion.id, "dismissed")}
            className="text-sm px-4 py-2.5 rounded-lg transition-colors"
            style={{
              background: "transparent",
              color: "var(--foreground-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Suggestions Page ─────────────────────────────────────────────────────────

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState(mockSuggestions);

  function handleAction(id: string, action: SuggestionStatus) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: action } : s))
    );
  }

  const pending = suggestions.filter((s) => s.status === "pending");
  const handled = suggestions.filter((s) => s.status !== "pending");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              建议与执行
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {pending.length > 0
                ? `${pending.length} 条建议待确认`
                : "暂无待确认建议"}
            </p>
          </div>
          {pending.length > 0 && (
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--alert-critical-muted)", color: "var(--alert-critical)" }}
            >
              {pending.length} 待处理
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="p-5 max-w-3xl mx-auto">
          {/* Pending suggestions */}
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
                所有建议已处理完毕
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {pending.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}

          {/* Handled suggestions */}
          {handled.length > 0 && (
            <div className="mt-8">
              <h2
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--foreground-subtle)" }}
              >
                已处理
              </h2>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: "var(--border)" }}
              >
                {handled.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: i % 2 === 0 ? "var(--surface)" : "var(--surface-raised)",
                    }}
                  >
                    <span className="text-sm font-mono" style={{ color: "var(--foreground-muted)" }}>
                      {s.expression}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background:
                          s.status === "confirmed" ? "var(--positive-muted)" :
                          s.status === "deferred" ? "var(--alert-medium-muted)" :
                          "var(--surface-overlay)",
                        color:
                          s.status === "confirmed" ? "var(--positive)" :
                          s.status === "deferred" ? "var(--alert-medium)" :
                          "var(--foreground-subtle)",
                      }}
                    >
                      {s.status === "confirmed" ? "已确认" :
                       s.status === "deferred" ? "已延后" : "已忽略"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
