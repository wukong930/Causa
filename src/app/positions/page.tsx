"use client";

import { useState } from "react";
import { mockPositionSnapshot } from "@/mocks/positions";
import { mockStrategies } from "@/mocks/strategies";
import { formatRelativeTime, formatNumber, clsx } from "@/lib/utils";
import { Drawer } from "@/components/shared/Drawer";

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

function AccountSummary() {
  const acc = mockPositionSnapshot.account;
  const marginUsed = acc.netValue * acc.marginUtilizationRate;

  return (
    <div className="mb-6">
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>
              保证金占用
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--surface-overlay)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(acc.marginUtilizationRate * 100)}%`,
                  background:
                    acc.marginUtilizationRate > 0.5
                      ? "var(--alert-high)"
                      : "var(--accent-blue)",
                }}
              />
            </div>
          </div>
          <span className="text-sm font-mono font-medium shrink-0" style={{ color: "var(--foreground)" }}>
            {Math.round(acc.marginUtilizationRate * 100)}%
          </span>
        </div>

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

function PositionDetail({
  position,
}: {
  position: (typeof mockPositionSnapshot.positions)[number];
}) {
  const totalPnl = position.unrealizedPnl;

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: "var(--positive-muted)",
              color: "var(--positive)",
            }}
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

      {/* P&L */}
      <div
        className="rounded-lg p-4 mb-6 text-center"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>浮动盈亏</div>
        <div
          className="text-2xl font-semibold font-mono"
          style={{ color: totalPnl >= 0 ? "var(--positive)" : "var(--negative)" }}
        >
          {totalPnl >= 0 ? "+" : ""}¥{formatNumber(totalPnl)}
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
          {position.spreadUnit}（入场 {position.entrySpread} → 当前 {position.currentSpread}）
        </div>
      </div>

      {/* Leg details */}
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
                  <div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                    {leg.entryPrice}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--foreground-subtle)" }}>当前价</span>
                  <div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                    {leg.currentPrice}
                  </div>
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

      {/* Position metrics */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--foreground-subtle)" }}>
          持仓状态
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>持仓天数</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {position.daysHeld}天
            </div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>半衰期</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              ~{position.halfLifeDays}天
            </div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>当前 Z-Score</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {position.currentZScore > 0 ? "+" : ""}{position.currentZScore.toFixed(2)}σ
            </div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>保证金占用</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              ¥{formatNumber(position.totalMarginUsed)}
            </div>
          </div>
        </div>
      </div>

      {/* Exit condition */}
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

export default function PositionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedPosition = selectedId
    ? mockPositionSnapshot.positions.find((p) => p.id === selectedId)
    : null;

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
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            持仓
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
            {mockPositionSnapshot.positions.length} 个活跃组合 · 更新于{" "}
            {formatRelativeTime(mockPositionSnapshot.updatedAt)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0 px-5 py-5">
        <AccountSummary />

        {/* Positions table */}
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
              {mockPositionSnapshot.positions.map((pos) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  onClick={() => openPosition(pos.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
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
