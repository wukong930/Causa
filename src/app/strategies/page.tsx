"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  StrategyPoolItem,
  StrategyStatus,
  SpreadModel,
  Direction,
  HypothesisLeg,
} from "@/types/domain";
import {
  getStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
} from "@/lib/api-client";
import {
  STRATEGY_STATUS_LABEL,
  SPREAD_MODEL_LABEL,
} from "@/lib/constants";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";
import { StrategyDetail } from "@/components/strategies/StrategyDetail";

// ─── Create form types ───────────────────────────────────────────────────────

type LegInput = { asset: string; direction: Direction; ratio: number; exchange: string };
type NewStrategyForm = {
  name: string;
  description: string;
  spreadModel: SpreadModel;
  legs: LegInput[];
  entryThreshold: number;
  exitThreshold: number;
  stopLossThreshold: number;
};

const DEFAULT_FORM: NewStrategyForm = {
  name: "",
  description: "",
  spreadModel: "calendar_spread",
  legs: [
    { asset: "", direction: "long", ratio: 1, exchange: "SHFE" },
    { asset: "", direction: "short", ratio: 1, exchange: "SHFE" },
  ],
  entryThreshold: 2.0,
  exitThreshold: 0.5,
  stopLossThreshold: 3.5,
};

const EXCHANGES = ["SHFE", "DCE", "CZCE", "INE", "CFFEX", "LME", "CME", "CBOT"];
const SPREAD_MODELS: SpreadModel[] = [
  "calendar_spread",
  "cross_commodity",
  "basis_trade",
  "inter_market",
  "triangular",
  "event_driven",
  "structural",
];

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateStrategyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (form: NewStrategyForm) => void;
}) {
  const [form, setForm] = useState<NewStrategyForm>({ ...DEFAULT_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setLeg(idx: number, field: keyof LegInput, value: string | number) {
    setForm((prev) => ({
      ...prev,
      legs: prev.legs.map((l, i) =>
        i === idx ? { ...l, [field]: field === "ratio" ? Number(value) : value } : l
      ),
    }));
  }

  function addLeg() {
    setForm((prev) => ({
      ...prev,
      legs: [...prev.legs, { asset: "", direction: "long", ratio: 1, exchange: "SHFE" }],
    }));
  }

  function removeLeg(idx: number) {
    setForm((prev) => ({ ...prev, legs: prev.legs.filter((_, i) => i !== idx) }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "策略名称不能为空";
    if (form.legs.length < 1) errs.legs = "至少需要一条腿";
    form.legs.forEach((leg, i) => {
      if (!leg.asset.trim()) errs[`leg_${i}`] = "品种代码不能为空";
    });
    if (form.entryThreshold <= 0) errs.entryThreshold = "入场阈值需大于 0";
    if (form.exitThreshold >= form.entryThreshold) errs.exitThreshold = "出场阈值需小于入场阈值";
    if (form.stopLossThreshold <= form.entryThreshold) errs.stopLossThreshold = "止损阈值需大于入场阈值";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onCreate(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            新建策略
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition"
            style={{ color: "var(--foreground-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
              策略名称 *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="如：铁矿石跨期价差 v3"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--surface-raised)",
                border: `1px solid ${errors.name ? "var(--negative)" : "var(--border)"}`,
                color: "var(--foreground)",
              }}
            />
            {errors.name && <p className="text-xs mt-1" style={{ color: "var(--negative)" }}>{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
              描述
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="简要描述策略逻辑与假设…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
              套利模型
            </label>
            <select
              value={form.spreadModel}
              onChange={(e) => setForm((p) => ({ ...p, spreadModel: e.target.value as SpreadModel }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              {SPREAD_MODELS.map((m) => (
                <option key={m} value={m}>{SPREAD_MODEL_LABEL[m] ?? m}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                套利腿 *
              </label>
              <button
                type="button"
                onClick={addLeg}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)", border: "1px solid var(--border)" }}
              >
                + 添加腿
              </button>
            </div>
            <div className="space-y-2">
              {form.legs.map((leg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={leg.direction}
                    onChange={(e) => setLeg(i, "direction", e.target.value)}
                    className="text-xs px-2 py-1.5 rounded"
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      color: leg.direction === "long" ? "var(--positive)" : "var(--negative)",
                    }}
                  >
                    <option value="long">做多</option>
                    <option value="short">做空</option>
                  </select>
                  <input
                    type="text"
                    value={leg.asset}
                    onChange={(e) => setLeg(i, "asset", e.target.value)}
                    placeholder="如 RB2506"
                    className="flex-1 px-2 py-1.5 rounded text-sm font-mono"
                    style={{
                      background: "var(--surface-raised)",
                      border: `1px solid ${errors[`leg_${i}`] ? "var(--negative)" : "var(--border)"}`,
                      color: "var(--foreground)",
                    }}
                  />
                  <select
                    value={leg.exchange}
                    onChange={(e) => setLeg(i, "exchange", e.target.value)}
                    className="text-xs px-2 py-1.5 rounded"
                    style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
                  >
                    {EXCHANGES.map((ex) => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={leg.ratio}
                    onChange={(e) => setLeg(i, "ratio", e.target.value)}
                    min={0.1}
                    step={0.1}
                    className="w-16 px-2 py-1.5 rounded text-xs text-center font-mono"
                    style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  {form.legs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLeg(i)}
                      className="text-xs p-1 rounded"
                      style={{ color: "var(--foreground-subtle)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.legs && <p className="text-xs mt-1" style={{ color: "var(--negative)" }}>{errors.legs}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "entryThreshold" as const, label: "入场阈值", placeholder: "2.0" },
              { key: "exitThreshold" as const, label: "出场阈值", placeholder: "0.5" },
              { key: "stopLossThreshold" as const, label: "止损阈值", placeholder: "3.5" },
            ]).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  {label}
                </label>
                <input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                  placeholder={placeholder}
                  step={0.1}
                  className="w-full px-3 py-1.5 rounded-lg text-sm font-mono text-right"
                  style={{
                    background: "var(--surface-raised)",
                    border: `1px solid ${errors[key] ? "var(--negative)" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                />
                {errors[key] && <p className="text-xs mt-0.5" style={{ color: "var(--negative)" }}>{errors[key]}</p>}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              创建策略
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  strategyName,
  onConfirm,
  onClose,
}: {
  strategyName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
          删除策略
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--foreground-muted)" }}>
          确定要删除「<strong style={{ color: "var(--foreground)" }}>{strategyName}</strong>」吗？此操作不可撤销。
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--negative)", color: "#fff" }}
          >
            删除
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm transition-colors"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

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

// ─── Strategy Card ─────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  onClick,
  onToggleActive,
}: {
  strategy: StrategyPoolItem;
  onClick: () => void;
  onToggleActive: (id: string) => void;
}) {
  const h = strategy.hypothesis;
  const isActive = strategy.status === "active" || strategy.status === "approaching_trigger";

  return (
    <div
      className="rounded-lg border p-4 transition-colors hover:brightness-110 cursor-pointer"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="text-sm font-medium truncate mb-0.5" style={{ color: "var(--foreground)" }}>
            {strategy.name}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-subtle)" }}>
            <span className="font-mono">{h.spreadModel.replace(/_/g, " ")}</span>
            <span>·</span>
            <span className="font-mono">{h.legs.map((l) => l.asset).join(" / ")}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
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
          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive(strategy.id); }}
            className="text-xs px-2 py-0.5 rounded transition-colors"
            style={{
              background: isActive ? "var(--negative-muted)" : "var(--positive-muted)",
              color: isActive ? "var(--negative)" : "var(--positive)",
            }}
            title={isActive ? "暂停策略" : "启用策略"}
          >
            {isActive ? "暂停" : "启用"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3" onClick={onClick}>
        <div className="rounded p-2 text-center" style={{ background: "var(--surface-overlay)" }}>
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>Z-Score</div>
          <div
            className="text-sm font-semibold font-mono"
            style={{ color: Math.abs(h.currentZScore) > 2 ? "var(--alert-critical)" : "var(--foreground)" }}
          >
            {h.currentZScore > 0 ? "+" : ""}{h.currentZScore.toFixed(2)}σ
          </div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: "var(--surface-overlay)" }}>
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>命中率</div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {(strategy.validation.hitRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: "var(--surface-overlay)" }}>
          <div className="text-xs mb-0.5" style={{ color: "var(--foreground-subtle)" }}>夏普</div>
          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {strategy.validation.sharpeRatio?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>

      <div className="mb-2" onClick={onClick}>
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
          <span>偏离程度</span>
          <span>
            触发阈值 {h.entryThreshold > 0 ? "+" : ""}{h.entryThreshold}σ
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-overlay)" }}>
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

      <div
        className="flex items-center gap-3 text-xs"
        style={{ color: "var(--foreground-subtle)" }}
        onClick={onClick}
      >
        <span>置信度 {formatConfidence(h.causalConfidence ?? 0)}</span>
        <span className="ml-auto">更新 {formatRelativeTime(h.lastUpdated)}</span>
      </div>
    </div>
  );
}

// ─── Strategy Table Row ────────────────────────────────────────────────────

function StrategyTableRow({
  strategy,
  onClick,
  onToggleActive,
}: {
  strategy: StrategyPoolItem;
  onClick: () => void;
  onToggleActive: (id: string) => void;
}) {
  const h = strategy.hypothesis;
  const isActive = strategy.status === "active" || strategy.status === "approaching_trigger";

  return (
    <tr
      onClick={onClick}
      className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{strategy.name}</div>
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
      <td className="px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(strategy.id); }}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{
            background: isActive ? "var(--negative-muted)" : "var(--positive-muted)",
            color: isActive ? "var(--negative)" : "var(--positive)",
          }}
        >
          {isActive ? "暂停" : "启用"}
        </button>
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
  const [strategies, setStrategies] = useState<StrategyPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StrategyStatus[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getStrategies();
    setStrategies(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return strategies
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
  }, [strategies, statusFilter, search]);

  const selectedStrategy = selectedId ? strategies.find((s) => s.id === selectedId) : null;

  function toggleStatus(s: StrategyStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function openStrategy(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  function handleToggleActive(id: string) {
    const s = strategies.find((x) => x.id === id);
    if (!s) return;
    const next: StrategyStatus =
      s.status === "active" || s.status === "approaching_trigger" ? "paused" : "active";
    // Optimistic update
    setStrategies((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, status: next, updatedAt: new Date().toISOString() } : x
      )
    );
    updateStrategy(id, { status: next });
  }

  async function handleCreate(form: NewStrategyForm) {
    const legs: HypothesisLeg[] = form.legs.map((l) => ({
      asset: l.asset.toUpperCase(),
      direction: l.direction,
      ratio: l.ratio,
      exchange: l.exchange,
    }));
    const created = await createStrategy({
      name: form.name.trim(),
      description: form.description.trim(),
      status: "draft",
      hypothesis: {
        id: `hyp-${Date.now()}`,
        spreadModel: form.spreadModel,
        legs,
        entryThreshold: form.entryThreshold,
        exitThreshold: form.exitThreshold,
        stopLossThreshold: form.stopLossThreshold,
        currentZScore: 0,
        halfLife: 0,
        adfPValue: 0,
        lastUpdated: new Date().toISOString(),
      },
      validation: {
        hitRate: 0,
        sampleCount: 0,
        avgHoldingDays: 0,
        costSpreadRatio: 0,
        stressLoss: 0,
      },
      relatedAlertIds: [],
      recommendationHistory: [],
      executionFeedbackIds: [],
    });
    setStrategies((prev) => [created, ...prev]);
    setShowCreate(false);
  }

  async function handleDelete(id: string) {
    await deleteStrategy(id);
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    setDeleteId(null);
    if (selectedId === id) {
      setDrawerOpen(false);
      setSelectedId(null);
    }
  }

  const counts = useMemo(() => {
    return ALL_STATUSES.reduce(
      (acc, s) => ({ ...acc, [s]: strategies.filter((x) => x.status === s).length }),
      {} as Record<StrategyStatus, number>
    );
  }, [strategies]);

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

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="hidden md:flex items-center gap-2">
              {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
                <span
                  key={s}
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
                >
                  {counts[s]} {STRATEGY_STATUS_LABEL[s]}
                </span>
              ))}
            </div>

            {/* Create button */}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              新建策略
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded px-3 py-2 mb-3"
          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)", flexShrink: 0 }}>
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
            <button onClick={() => setSearch("")} style={{ color: "var(--foreground-subtle)" }}>
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
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Strategy list ── */}
      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 animate-pulse"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="h-4 w-3/4 rounded mb-2" style={{ background: "var(--surface-overlay)" }} />
                <div className="h-3 w-1/2 rounded mb-4" style={{ background: "var(--surface-overlay)" }} />
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="h-14 rounded" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-14 rounded" style={{ background: "var(--surface-overlay)" }} />
                  <div className="h-14 rounded" style={{ background: "var(--surface-overlay)" }} />
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--surface-overlay)" }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
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
                onToggleActive={handleToggleActive}
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
                  <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>策略</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>状态</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>Z-Score</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>命中率</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>夏普</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>更新</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>启停</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((strategy) => (
                  <StrategyTableRow
                    key={strategy.id}
                    strategy={strategy}
                    onClick={() => openStrategy(strategy.id)}
                    onToggleActive={handleToggleActive}
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
            onStatusChange={handleToggleActive}
            onDelete={(id) => setDeleteId(id)}
            refresh={refresh}
          />
        )}
      </Drawer>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateStrategyModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteId && (
        <DeleteConfirmModal
          strategyName={strategies.find((s) => s.id === deleteId)?.name ?? ""}
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
