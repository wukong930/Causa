"use client";

import { useState, useEffect } from "react";
import { getExecutionDrafts, updateExecutionDraft } from "@/lib/api-client";
import type { ExecutionDraft, ExecutionDraftStatus } from "@/types/domain";
import { formatRelativeTime } from "@/lib/utils";
import { ExecutionFeedbackForm } from "@/components/execution/FeedbackForm";

const STATUS_CONFIG: Record<ExecutionDraftStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "草稿", color: "var(--foreground-muted)", bg: "var(--surface-overlay)" },
  submitted: { label: "已提交", color: "var(--accent-blue)", bg: "var(--accent-blue-subtle)" },
  executed: { label: "已执行", color: "var(--positive)", bg: "var(--positive-subtle)" },
  cancelled: { label: "已取消", color: "var(--foreground-subtle)", bg: "var(--surface-raised)" },
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<ExecutionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ExecutionDraftStatus | "all">("all");
  const [feedbackDraftId, setFeedbackDraftId] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [filterStatus]);

  async function loadDrafts() {
    setLoading(true);
    const filters = filterStatus !== "all" ? { status: filterStatus } : undefined;
    const data = await getExecutionDrafts(filters);
    setDrafts(data);
    setLoading(false);
  }

  async function handleSubmit(id: string) {
    const updated = await updateExecutionDraft(id, { status: "submitted", submittedAt: new Date().toISOString() });
    if (updated) {
      setDrafts((prev) => prev.map((d) => (d.id === id ? updated : d)));
    }
  }

  async function handleCancel(id: string) {
    const updated = await updateExecutionDraft(id, { status: "cancelled" });
    if (updated) {
      setDrafts((prev) => prev.map((d) => (d.id === id ? updated : d)));
    }
  }

  const selectedDraft = selectedId ? drafts.find((d) => d.id === selectedId) : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            执行草稿
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            确认推荐后的执行计划，编辑后提交至交易系统
          </p>
        </div>
        <button
          onClick={loadDrafts}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--surface-overlay)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          刷新
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "draft", "submitted", "executed", "cancelled"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: filterStatus === status ? "var(--accent-blue)" : "var(--surface-overlay)",
              color: filterStatus === status ? "#fff" : "var(--foreground-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {status === "all" ? "全部" : STATUS_CONFIG[status].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--foreground-muted)" }}>
          加载中...
        </div>
      ) : drafts.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--foreground-muted)" }}>暂无执行草稿</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onSelect={() => setSelectedId(draft.id)}
              onSubmit={() => handleSubmit(draft.id)}
              onCancel={() => handleCancel(draft.id)}
              onBackfill={() => setFeedbackDraftId(draft.id)}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selectedDraft && (
        <DraftDetailDrawer
          draft={selectedDraft}
          onClose={() => setSelectedId(null)}
          onUpdate={(updated) => {
            setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setSelectedId(null);
          }}
        />
      )}

      {/* Feedback form overlay */}
      {feedbackDraftId && (() => {
        const draft = drafts.find((d) => d.id === feedbackDraftId);
        if (!draft) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setFeedbackDraftId(null)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExecutionFeedbackForm
                recommendationId={draft.recommendationId}
                prefillLegs={draft.legs.map((l) => ({
                  asset: l.asset,
                  direction: l.direction,
                  size: l.requestedSize,
                  unit: l.unit,
                }))}
                onSuccess={async () => {
                  await updateExecutionDraft(draft.id, { status: "executed" });
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, status: "executed" as ExecutionDraftStatus } : d))
                  );
                  setFeedbackDraftId(null);
                }}
                onCancel={() => setFeedbackDraftId(null)}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DraftCard({
  draft,
  onSelect,
  onSubmit,
  onCancel,
  onBackfill,
}: {
  draft: ExecutionDraft;
  onSelect: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onBackfill: () => void;
}) {
  const statusCfg = STATUS_CONFIG[draft.status];

  return (
    <div
      className="rounded-lg p-4 cursor-pointer transition-colors"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {draft.recommendationId.slice(0, 8)}
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: statusCfg.bg, color: statusCfg.color }}
            >
              {statusCfg.label}
            </span>
          </div>
          <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            {draft.legs.length} 条腿 · 保证金 ¥{draft.totalMarginUsed.toLocaleString()}
          </div>
        </div>
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(draft.createdAt)}
        </span>
      </div>

      {/* Legs preview */}
      <div className="flex flex-col gap-1 mb-3">
        {draft.legs.slice(0, 2).map((leg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
            <span
              className="px-1.5 py-0.5 rounded font-medium"
              style={{
                background: leg.direction === "long" ? "var(--positive-subtle)" : "var(--negative-subtle)",
                color: leg.direction === "long" ? "var(--positive)" : "var(--negative)",
              }}
            >
              {leg.direction === "long" ? "多" : "空"}
            </span>
            <span>{leg.asset}</span>
            <span>×{leg.requestedSize}</span>
            {leg.requestedPrice && <span>@ ¥{leg.requestedPrice}</span>}
          </div>
        ))}
        {draft.legs.length > 2 && (
          <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            +{draft.legs.length - 2} 条腿
          </div>
        )}
      </div>

      {/* Actions */}
      {draft.status === "draft" && (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onSubmit}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            提交执行
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--surface-overlay)",
              border: "1px solid var(--border)",
              color: "var(--foreground-muted)",
            }}
          >
            取消
          </button>
        </div>
      )}
      {draft.status === "submitted" && (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onBackfill}
            className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--positive)", color: "#fff" }}
          >
            回填成交
          </button>
        </div>
      )}
    </div>
  );
}

function DraftDetailDrawer({
  draft,
  onClose,
  onUpdate,
}: {
  draft: ExecutionDraft;
  onClose: () => void;
  onUpdate: (draft: ExecutionDraft) => void;
}) {
  const [editedLegs, setEditedLegs] = useState(draft.legs);
  const [notes, setNotes] = useState(draft.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = await updateExecutionDraft(draft.id, { legs: editedLegs, notes });
    setSaving(false);
    if (updated) {
      onUpdate(updated);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 p-4 flex items-center justify-between" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            编辑执行草稿
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: "var(--foreground-muted)" }}>
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Legs */}
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              执行腿
            </h3>
            {editedLegs.map((leg, i) => (
              <div
                key={i}
                className="rounded-lg p-3 mb-2"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: leg.direction === "long" ? "var(--positive-subtle)" : "var(--negative-subtle)",
                      color: leg.direction === "long" ? "var(--positive)" : "var(--negative)",
                    }}
                  >
                    {leg.direction === "long" ? "做多" : "做空"}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {leg.asset}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
                      数量
                    </label>
                    <input
                      type="number"
                      value={leg.requestedSize}
                      onChange={(e) => {
                        const newLegs = [...editedLegs];
                        newLegs[i].requestedSize = parseFloat(e.target.value);
                        setEditedLegs(newLegs);
                      }}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
                      价格（可选）
                    </label>
                    <input
                      type="number"
                      value={leg.requestedPrice || ""}
                      onChange={(e) => {
                        const newLegs = [...editedLegs];
                        newLegs[i].requestedPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                        setEditedLegs(newLegs);
                      }}
                      placeholder="市价"
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              备注
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="执行注意事项..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "var(--accent-blue)",
                color: "#fff",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "保存中..." : "保存修改"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "var(--surface-overlay)",
                border: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
