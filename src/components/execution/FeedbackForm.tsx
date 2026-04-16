"use client";

import { useState } from "react";
import { createExecutionFeedback } from "@/lib/api-client";
import type { ExecutionFeedbackLeg, Direction, FeedbackLegType } from "@/types/domain";

interface FeedbackFormProps {
  recommendationId?: string;
  strategyId?: string;
  prefillLegs?: Array<{ asset: string; direction: Direction; size: number; unit: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface LegFormData {
  asset: string;
  direction: Direction;
  type: FeedbackLegType;
  filledSize: string;
  filledPrice: string;
  filledAt: string;
  unit: string;
  commission: string;
}

function emptyLeg(): LegFormData {
  return {
    asset: "",
    direction: "long",
    type: "open",
    filledSize: "",
    filledPrice: "",
    filledAt: new Date().toISOString().slice(0, 16),
    unit: "手",
    commission: "",
  };
}

export function ExecutionFeedbackForm({
  recommendationId,
  strategyId,
  prefillLegs,
  onSuccess,
  onCancel,
}: FeedbackFormProps) {
  const [legs, setLegs] = useState<LegFormData[]>(
    prefillLegs
      ? prefillLegs.map((l) => ({
          ...emptyLeg(),
          asset: l.asset,
          direction: l.direction,
          filledSize: String(l.size),
          unit: l.unit,
        }))
      : [emptyLeg()]
  );
  const [slippageNote, setSlippageNote] = useState("");
  const [liquidityNote, setLiquidityNote] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLeg(index: number, field: keyof LegFormData, value: string) {
    setLegs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLeg() {
    setLegs((prev) => [...prev, emptyLeg()]);
  }

  function removeLeg(index: number) {
    if (legs.length <= 1) return;
    setLegs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    // Validate
    for (const leg of legs) {
      if (!leg.asset || !leg.filledSize || !leg.filledPrice) {
        setError("请填写所有腿的品种、数量和价格");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const feedbackLegs: ExecutionFeedbackLeg[] = legs.map((l) => ({
      asset: l.asset,
      direction: l.direction as Direction,
      type: l.type as FeedbackLegType,
      filledSize: parseFloat(l.filledSize),
      filledPrice: parseFloat(l.filledPrice),
      filledAt: new Date(l.filledAt).toISOString(),
      unit: l.unit,
      commission: parseFloat(l.commission) || 0,
    }));

    const totalCommission = feedbackLegs.reduce((s, l) => s + l.commission, 0);
    const totalMargin = feedbackLegs.reduce(
      (s, l) => s + l.filledPrice * l.filledSize * 10,
      0
    );

    try {
      await createExecutionFeedback({
        recommendationId,
        strategyId,
        legs: feedbackLegs,
        totalMarginUsed: totalMargin,
        totalCommission: totalCommission,
        slippageNote: slippageNote || undefined,
        liquidityNote: liquidityNote || undefined,
        notes: notes || undefined,
      });
      onSuccess?.();
    } catch (err) {
      setError("提交失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        成交回填
      </h3>

      {/* Legs */}
      {legs.map((leg, i) => (
        <div
          key={i}
          className="rounded-lg p-3"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
              第 {i + 1} 腿
            </span>
            {legs.length > 1 && (
              <button
                onClick={() => removeLeg(i)}
                className="text-xs px-2 py-0.5 rounded"
                style={{ color: "var(--negative)", background: "var(--negative-subtle)" }}
              >
                删除
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>品种</label>
              <input
                value={leg.asset}
                onChange={(e) => updateLeg(i, "asset", e.target.value)}
                placeholder="RB2506"
                className="w-full px-2 py-1.5 rounded text-sm font-mono"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>方向</label>
              <select
                value={leg.direction}
                onChange={(e) => updateLeg(i, "direction", e.target.value)}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="long">做多</option>
                <option value="short">做空</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>类型</label>
              <select
                value={leg.type}
                onChange={(e) => updateLeg(i, "type", e.target.value)}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="open">开仓</option>
                <option value="close">平仓</option>
                <option value="add">加仓</option>
                <option value="reduce">减仓</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>成交量</label>
              <input
                type="number"
                value={leg.filledSize}
                onChange={(e) => updateLeg(i, "filledSize", e.target.value)}
                placeholder="4"
                className="w-full px-2 py-1.5 rounded text-sm font-mono"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>成交价</label>
              <input
                type="number"
                value={leg.filledPrice}
                onChange={(e) => updateLeg(i, "filledPrice", e.target.value)}
                placeholder="812"
                className="w-full px-2 py-1.5 rounded text-sm font-mono"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>成交时间</label>
              <input
                type="datetime-local"
                value={leg.filledAt}
                onChange={(e) => updateLeg(i, "filledAt", e.target.value)}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>手续费</label>
              <input
                type="number"
                value={leg.commission}
                onChange={(e) => updateLeg(i, "commission", e.target.value)}
                placeholder="320"
                className="w-full px-2 py-1.5 rounded text-sm font-mono"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addLeg}
        className="w-full py-2 rounded-lg text-sm font-medium"
        style={{ background: "var(--surface-overlay)", border: "1px dashed var(--border)", color: "var(--foreground-muted)" }}
      >
        + 添加一腿
      </button>

      {/* Notes */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>滑点备注</label>
          <input
            value={slippageNote}
            onChange={(e) => setSlippageNote(e.target.value)}
            placeholder="滑点情况..."
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>流动性备注</label>
          <input
            value={liquidityNote}
            onChange={(e) => setLiquidityNote(e.target.value)}
            placeholder="流动性情况..."
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>备注</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="执行备注..."
          rows={2}
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--positive)", color: "#fff", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "提交中..." : "提交回填"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
