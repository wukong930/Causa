"use client";

import { useState } from "react";
import {
  mockPositionSnapshot,
  mockExecutionFeedbacks,
} from "@/lib/mockData";
import { formatRelativeTime, formatNumber } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";
import type { ExecutionFeedback } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PnlBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className="text-sm font-semibold font-mono"
      style={{ color: isPositive ? "var(--positive)" : "var(--negative)" }}
    >
      {isPositive ? "+" : ""}{formatNumber(value)}
    </span>
  );
}

function MarginBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 70 ? "var(--alert-critical)" :
    pct >= 50 ? "var(--alert-high)" :
    "var(--accent-blue)";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="text-sm font-semibold font-mono"
          style={{ color }}
        >
          {pct}%
        </span>
        {pct >= 70 && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--alert-critical-muted)", color: "var(--alert-critical)" }}>
            告警
          </span>
        )}
        {pct >= 50 && pct < 70 && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--alert-high-muted)", color: "var(--alert-high)" }}>
            预警
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Account Summary ─────────────────────────────────────────────────────────

function AccountSummary() {
  const acc = mockPositionSnapshot.account;
  const marginUsed = acc.netValue * acc.marginUtilizationRate;

  return (
    <div className="mb-6">
      <div
        className="rounded-lg p-5"
        style={{
          background: "var(--surface)",
          border: `1px solid ${
            acc.marginUtilizationRate >= 0.7
              ? "var(--alert-critical)"
              : acc.marginUtilizationRate >= 0.5
              ? "var(--alert-high)"
              : "var(--border)"
          }`,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
              账户净值
            </div>
            <div className="text-2xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              ¥{formatNumber(acc.netValue)}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>今日损益</div>
                <PnlBadge value={acc.todayRealizedPnl} />
              </div>
              <div className="border-l pl-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>浮动盈亏</div>
                <PnlBadge value={acc.totalUnrealizedPnl} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>
            <span>保证金占用</span>
            <span>¥{formatNumber(marginUsed)} / ¥{formatNumber(acc.availableMargin + marginUsed)}</span>
          </div>
          <MarginBar rate={acc.marginUtilizationRate} />
        </div>

        {/* Warning banner */}
        {acc.marginUtilizationRate >= 0.5 && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4"
            style={{
              background: acc.marginUtilizationRate >= 0.7
                ? "var(--alert-critical-muted)"
                : "var(--alert-high-muted)",
            }}
          >
            <span style={{ color: acc.marginUtilizationRate >= 0.7 ? "var(--alert-critical)" : "var(--alert-high)" }}>
              ⚠
            </span>
            <p className="text-xs" style={{ color: acc.marginUtilizationRate >= 0.7 ? "var(--alert-critical)" : "var(--alert-high)" }}>
              {acc.marginUtilizationRate >= 0.7
                ? "保证金占用率已超 70%，接近强平风险，请及时减仓或追加保证金。"
                : "保证金占用率已超 50%，建议关注仓位集中度。"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-overlay)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>已用保证金</div>
            <div className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
              ¥{formatNumber(marginUsed)}
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-overlay)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>可用保证金</div>
            <div className="text-sm font-mono font-medium" style={{ color: "var(--positive)" }}>
              ¥{formatNumber(acc.availableMargin)}
            </div>
          </div>
        </div>

        <div className="text-xs mt-3" style={{ color: "var(--foreground-subtle)" }}>
          快照时间 {formatRelativeTime(acc.snapshotAt)}
        </div>
      </div>
    </div>
  );
}

// ─── Position Row ─────────────────────────────────────────────────────────────

function PositionRow({
  position,
  onClick,
}: {
  position: (typeof mockPositionSnapshot.positions)[number];
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3">
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {position.strategyName}
        </div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          {position.legs.map((l) => l.asset).join(" / ")}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <PnlBadge value={position.unrealizedPnl} />
        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          {position.spreadUnit}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div
          className="text-sm font-mono font-medium"
          style={{
            color:
              Math.abs(position.currentZScore) > 2
                ? "var(--alert-critical)"
                : Math.abs(position.currentZScore) > 1.5
                ? "var(--alert-high)"
                : "var(--foreground)",
          }}
        >
          {position.currentZScore > 0 ? "+" : ""}{position.currentZScore.toFixed(2)}σ
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
          目标 {position.targetZScore > 0 ? "+" : ""}{position.targetZScore}σ
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono" style={{ color: "var(--foreground)" }}>
          {position.daysHeld}天
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: "var(--positive-muted)",
            color: "var(--positive)",
          }}
        >
          {position.status === "open" ? "持仓中" : position.status}
        </span>
      </td>
    </tr>
  );
}

// ─── Position Detail ──────────────────────────────────────────────────────────

function PositionDetail({
  position,
}: {
  position: (typeof mockPositionSnapshot.positions)[number];
}) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: "var(--positive-muted)", color: "var(--positive)" }}
          >
            {position.status === "open" ? "持仓中" : position.status}
          </span>
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            开仓于 {formatRelativeTime(position.openedAt)}
          </span>
        </div>
        <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
          {position.strategyName}
        </h2>
        <div className="text-sm font-mono mt-0.5" style={{ color: "var(--accent-blue)" }}>
          {position.legs.map((l) => l.asset).join(" / ")}
        </div>
      </div>

      <div
        className="rounded-lg p-4 mb-6 text-center"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>浮动盈亏</div>
        <div
          className="text-2xl font-semibold font-mono"
          style={{ color: position.unrealizedPnl >= 0 ? "var(--positive)" : "var(--negative)" }}
        >
          {position.unrealizedPnl >= 0 ? "+" : ""}¥{formatNumber(position.unrealizedPnl)}
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
          {position.spreadUnit}（入场 {position.entrySpread} → 当前 {position.currentSpread}）
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
          持仓明细
        </h3>
        <div className="flex flex-col gap-2">
          {position.legs.map((leg, i) => (
            <div
              key={i}
              className="rounded-lg px-4 py-3"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded font-mono"
                  style={{
                    background: leg.direction === "long" ? "var(--positive-muted)" : "var(--negative-muted)",
                    color: leg.direction === "long" ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {leg.direction === "long" ? "做多" : "做空"}
                </span>
                <span className="font-mono font-medium text-sm" style={{ color: "var(--foreground)" }}>
                  {leg.asset}
                </span>
                <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {leg.size} {leg.unit}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span style={{ color: "var(--foreground-subtle)" }}>入场价</span>
                  <div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{leg.entryPrice}</div>
                </div>
                <div>
                  <span style={{ color: "var(--foreground-subtle)" }}>当前价</span>
                  <div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{leg.currentPrice}</div>
                </div>
                <div>
                  <span style={{ color: "var(--foreground-subtle)" }}>单腿盈亏</span>
                  <div
                    className="font-mono font-medium"
                    style={{ color: leg.unrealizedPnl >= 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    {leg.unrealizedPnl >= 0 ? "+" : ""}{formatNumber(leg.unrealizedPnl)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
          持仓状态
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>持仓天数</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>{position.daysHeld}天</div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>半衰期</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>~{position.halfLifeDays}天</div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>当前 Z-Score</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {position.currentZScore > 0 ? "+" : ""}{position.currentZScore.toFixed(2)}σ
            </div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>保证金占用</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>¥{formatNumber(position.totalMarginUsed)}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
          出场条件
        </h3>
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          {position.exitCondition}
        </p>
      </div>
    </div>
  );
}

// ─── Execution Feedback Viewer ─────────────────────────────────────────────────

function ExecutionFeedbackCard({ fb }: { fb: ExecutionFeedback }) {
  const totalPnl = fb.legs
    .filter((l) => l.type === "close")
    .reduce((sum, l) => sum + (l.filledPrice * l.filledSize * 10), 0); // simplified

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {fb.strategyId ?? fb.recommendationId ?? fb.id}
          </span>
          <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
            {fb.legs.length} 笔成交 · 手续费 ¥{fb.totalCommission}
          </div>
        </div>
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {formatRelativeTime(fb.createdAt)}
        </span>
      </div>

      {/* Leg fills */}
      <div className="flex flex-col gap-1.5 mb-3">
        {fb.legs.map((leg, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                background: leg.type === "open" ? "var(--positive-muted)" : "var(--negative-muted)",
                color: leg.type === "open" ? "var(--positive)" : "var(--negative)",
              }}
            >
              {leg.type === "open" ? "开" : "平"}
            </span>
            <span className="font-mono" style={{ color: "var(--accent-blue)" }}>{leg.asset}</span>
            <span style={{ color: leg.direction === "long" ? "var(--positive)" : "var(--negative)" }}>
              {leg.direction === "long" ? "多" : "空"}
            </span>
            <span className="ml-auto font-mono">
              {leg.filledSize}手 @{leg.filledPrice}
            </span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {fb.notes && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {fb.notes}
        </p>
      )}
      {fb.slippageNote && (
        <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
          滑点：{fb.slippageNote}
        </p>
      )}
    </div>
  );
}

// ─── Positions Page ───────────────────────────────────────────────────────────

export default function PositionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"open" | "history" | "feedback">("open");

  const selectedPosition = selectedId
    ? mockPositionSnapshot.positions.find((p) => p.id === selectedId)
    : null;

  const openPositions = mockPositionSnapshot.positions.filter((p) => p.status === "open");

  function openPosition(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-5 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              持仓
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {openPositions.length} 个活跃组合 · 更新于{" "}
              {formatRelativeTime(mockPositionSnapshot.updatedAt)}
            </p>
          </div>

          {/* Tab toggle */}
          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ background: "var(--surface-overlay)" }}
          >
            {[
              { key: "open", label: "持仓中", count: openPositions.length },
              { key: "history", label: "历史" },
              { key: "feedback", label: "执行反馈", count: mockExecutionFeedbacks.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  background: activeTab === tab.key ? "var(--surface)" : "transparent",
                  color: activeTab === tab.key ? "var(--foreground)" : "var(--foreground-muted)",
                  boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                }}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span
                    className="text-xs px-1 py-0.5 rounded-full"
                    style={{ background: "var(--accent-blue)", color: "#fff" }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0 px-5 py-5">
        {activeTab === "open" && (
          <>
            <AccountSummary />

            <div
              className="rounded-lg overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                      策略
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                      浮动盈亏
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                      Z-Score
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                      持仓天数
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((pos) => (
                    <PositionRow
                      key={pos.id}
                      position={pos}
                      onClick={() => openPosition(pos.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "history" && (
          <div
            className="rounded-lg p-5 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--foreground-subtle)", margin: "0 auto" }}>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <p className="text-sm mt-3" style={{ color: "var(--foreground-muted)" }}>
              已平仓记录开发中
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
              平仓后的策略将显示在此处，包含完整收益回顾
            </p>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="flex flex-col gap-4">
            {mockExecutionFeedbacks.length === 0 ? (
              <div
                className="rounded-lg p-5 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  暂无执行反馈记录
                </p>
              </div>
            ) : (
              mockExecutionFeedbacks.map((fb) => (
                <ExecutionFeedbackCard key={fb.id} fb={fb} />
              ))
            )}
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="持仓详情"
        width="520px"
      >
        {selectedPosition && <PositionDetail position={selectedPosition} />}
      </Drawer>
    </div>
  );
}
