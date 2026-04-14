"use client";

import { useState, useMemo } from "react";
import { mockSetups } from "@/mocks/setups";
import type { Setup, SetupStatus } from "@/types/domain";
import { Drawer } from "@/components/shared/Drawer";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { CategoryBadge } from "@/components/shared/Badges";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";
import {
  SETUP_STATUS_LABEL,
  SETUP_STATUS_COLOR,
  CATEGORY_LABEL,
} from "@/lib/constants";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SetupStatus }) {
  const colorMap: Record<SetupStatus, { bg: string; text: string }> = {
    watching: { bg: "var(--surface-overlay)", text: "var(--foreground-muted)" },
    approaching_trigger: { bg: "var(--alert-high-muted)", text: "var(--alert-high)" },
    triggered: { bg: "var(--alert-critical-muted)", text: "var(--alert-critical)" },
    invalid: { bg: "var(--surface-overlay)", text: "var(--foreground-subtle)" },
    completed: { bg: "var(--positive-muted)", text: "var(--positive)" },
  };
  const c = colorMap[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {SETUP_STATUS_LABEL[status]}
    </span>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

// ─── Setup Card (card view) ───────────────────────────────────────────────────

function SetupCard({ setup, onClick }: { setup: Setup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg p-4 border transition-colors hover:border-[var(--accent-blue)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>
          {setup.name}
        </div>
        <StatusBadge status={setup.status} />
      </div>

      <div className="text-xs mb-3" style={{ color: "var(--foreground-muted)" }}>
        {setup.hypothesisType} · {setup.family.replace(/_/g, " ")}
      </div>

      {/* Assets */}
      <div className="flex gap-1.5 mb-3">
        {setup.assets.map((a) => (
          <span
            key={a}
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)" }}
          >
            {a}
          </span>
        ))}
      </div>

      {/* Progress bars */}
      <div className="flex flex-col gap-1.5">
        <ProgressBar
          value={setup.confidence}
          label="置信度"
          color={
            setup.confidence > 0.8 ? "var(--positive)" :
            setup.confidence > 0.6 ? "var(--accent-blue)" :
            "var(--alert-high)"
          }
        />
        <ProgressBar
          value={setup.tradability}
          label="可交易性"
          color="var(--foreground-muted)"
        />
      </div>

      <div className="text-xs mt-3" style={{ color: "var(--foreground-subtle)" }}>
        更新于 {formatRelativeTime(setup.updatedAt)}
      </div>
    </button>
  );
}

// ─── Setup Table Row (table view) ─────────────────────────────────────────────

function SetupTableRow({ setup, onClick }: { setup: Setup; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="border-b cursor-pointer transition-colors hover:brightness-110"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {setup.name}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
          {setup.hypothesisType}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {setup.assets.map((a) => (
            <span key={a} className="text-xs font-mono" style={{ color: "var(--accent-blue)" }}>
              {a}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={setup.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-16 rounded-full overflow-hidden"
            style={{ background: "var(--surface-overlay)", height: "4px" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(setup.confidence * 100)}%`,
                background: setup.confidence > 0.8 ? "var(--positive)" : "var(--accent-blue)",
              }}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            {formatConfidence(setup.confidence)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {formatConfidence(setup.tradability)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(setup.updatedAt)}
        </span>
      </td>
    </tr>
  );
}

// ─── Setup Detail ─────────────────────────────────────────────────────────────

function SetupDetailDrawer({ setup }: { setup: Setup }) {
  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-5">
        <h3
          className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--foreground-subtle)" }}
        >
          {title}
        </h3>
        {children}
      </div>
    );
  }

  function InfoBox({ text }: { text: string }) {
    return (
      <div
        className="rounded-lg p-3 text-sm"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
      >
        {text}
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <StatusBadge status={setup.status} />
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            {setup.family.replace(/_/g, " ")}
          </span>
        </div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          {setup.name}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {setup.description}
        </p>
      </div>

      {/* Assets + scores */}
      <div
        className="rounded-lg p-4 mb-5 grid grid-cols-2 gap-4"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>涉及资产</div>
          <div className="flex flex-wrap gap-1.5">
            {setup.assets.map((a) => (
              <span
                key={a}
                className="text-sm font-mono px-2 py-0.5 rounded"
                style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)" }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <ProgressBar value={setup.confidence} label="置信度"
            color={setup.confidence > 0.8 ? "var(--positive)" : "var(--accent-blue)"}
          />
          <ProgressBar value={setup.tradability} label="可交易性" color="var(--foreground-muted)" />
        </div>
      </div>

      <Section title="入场条件">
        <InfoBox text={setup.entryCondition} />
      </Section>

      <Section title="出场条件">
        <InfoBox text={setup.exitCondition} />
      </Section>

      <Section title="失效条件">
        <InfoBox text={setup.invalidationCondition} />
      </Section>

      {setup.riskItems.length > 0 && (
        <Section title="风险项">
          <div
            className="rounded-lg px-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {setup.riskItems.map((r) => (
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
        </Section>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          className="flex-1 text-sm py-2 rounded font-medium"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          生成建议
        </button>
        <button
          className="text-sm px-4 py-2 rounded"
          style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
        >
          加入关注
        </button>
      </div>
    </div>
  );
}

// ─── Setups Page ──────────────────────────────────────────────────────────────

const ALL_STATUSES: SetupStatus[] = ["triggered", "approaching_trigger", "watching", "completed", "invalid"];

export default function SetupsPage() {
  const [view, setView] = useState<"card" | "table">("card");
  const [statusFilter, setStatusFilter] = useState<SetupStatus[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return mockSetups
      .filter((s) => {
        if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!s.name.toLowerCase().includes(q) && !s.assets.some((a) => a.toLowerCase().includes(q))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<SetupStatus, number> = {
          triggered: 0,
          approaching_trigger: 1,
          watching: 2,
          completed: 3,
          invalid: 4,
        };
        return order[a.status] - order[b.status];
      });
  }, [statusFilter, search]);

  const selectedSetup = selectedId ? mockSetups.find((s) => s.id === selectedId) : null;

  function openSetup(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
              {filtered.length} 个候选策略
            </p>
          </div>
          {/* View toggle */}
          <div
            className="flex rounded overflow-hidden border"
            style={{ borderColor: "var(--border)" }}
          >
            {(["card", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="text-xs px-3 py-1.5"
                style={{
                  background: view === v ? "var(--accent-blue)" : "var(--surface)",
                  color: view === v ? "#fff" : "var(--foreground-muted)",
                }}
              >
                {v === "card" ? "卡片" : "表格"}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded px-3 py-2 mb-3"
          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
            <button onClick={() => setSearch("")} style={{ color: "var(--foreground-subtle)" }}>×</button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs mr-1" style={{ color: "var(--foreground-subtle)" }}>状态：</span>
          {ALL_STATUSES.map((s) => (
            <FilterPill
              key={s}
              label={SETUP_STATUS_LABEL[s]}
              active={statusFilter.includes(s)}
              onClick={() =>
                setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                )
              }
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>没有符合条件的策略</p>
          </div>
        ) : view === "card" ? (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((setup) => (
              <SetupCard key={setup.id} setup={setup} onClick={() => openSetup(setup.id)} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["策略名称", "资产", "状态", "置信度", "可交易性", "更新时间"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-xs font-semibold"
                      style={{ color: "var(--foreground-subtle)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((setup) => (
                  <SetupTableRow key={setup.id} setup={setup} onClick={() => openSetup(setup.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="策略详情"
        width="560px"
      >
        {selectedSetup && <SetupDetailDrawer setup={selectedSetup} />}
      </Drawer>
    </div>
  );
}
