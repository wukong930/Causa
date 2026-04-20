"use client";

import { useState, useEffect, useMemo } from "react";
import { getPositions, getAccountSnapshot, getRiskVaR, getStressTest, getCorrelationMatrix } from "@/lib/api-client";
import { formatRelativeTime, formatNumber } from "@/lib/utils";
import { COMMODITY_NAME_MAP } from "@/lib/constants";
import type { VaRResult } from "@/lib/risk/var";
import type { StressTestResult } from "@/lib/risk/stress";
import type { CorrelationMatrix } from "@/lib/risk/correlation";
import { Drawer } from "@/components/shared/Drawer";
import { RiskMetricsDashboard } from "@/components/positions/RiskMetricsDashboard";
import { HistoricalChart } from "@/components/positions/HistoricalChart";
import { ExitSignalsBanner } from "@/components/positions/ExitSignalsBanner";
import {
  calculatePortfolioRisk,
  calculatePositionHealth,
  detectExitSignals,
  buildCumulativePnL,
  buildDrawdownSeries,
} from "@/lib/analytics";
import type { PositionGroup, AccountSnapshot } from "@/types/domain";

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
    "var(--accent-primary)";

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

function AccountSummary({ account }: { account: AccountSnapshot | null }) {
  if (!account) {
    return (
      <div className="mb-6 rounded-lg p-5 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="h-6 w-32 rounded mb-3" style={{ background: "var(--surface-overlay)" }} />
        <div className="h-8 w-48 rounded mb-4" style={{ background: "var(--surface-overlay)" }} />
        <div className="h-2 w-full rounded-full" style={{ background: "var(--surface-overlay)" }} />
      </div>
    );
  }

  const marginUsed = account.netValue * account.marginUtilizationRate;

  return (
    <div className="mb-6">
      <div
        className="rounded-lg p-5"
        style={{
          background: "var(--surface)",
          border: `1px solid ${
            account.marginUtilizationRate >= 0.7
              ? "var(--alert-critical)"
              : account.marginUtilizationRate >= 0.5
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
              ¥{formatNumber(account.netValue)}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>今日损益</div>
                <PnlBadge value={account.todayRealizedPnl} />
              </div>
              <div className="border-l pl-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>浮动盈亏</div>
                <PnlBadge value={account.totalUnrealizedPnl} />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--foreground-subtle)" }}>
            <span>保证金占用</span>
            <span>¥{formatNumber(marginUsed)} / ¥{formatNumber(account.availableMargin + marginUsed)}</span>
          </div>
          <MarginBar rate={account.marginUtilizationRate} />
        </div>

        {/* Warning banner */}
        {account.marginUtilizationRate >= 0.5 && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4"
            style={{
              background: account.marginUtilizationRate >= 0.7
                ? "var(--alert-critical-muted)"
                : "var(--alert-high-muted)",
            }}
          >
            <span style={{ color: account.marginUtilizationRate >= 0.7 ? "var(--alert-critical)" : "var(--alert-high)" }}>
              ⚠
            </span>
            <p className="text-xs" style={{ color: account.marginUtilizationRate >= 0.7 ? "var(--alert-critical)" : "var(--alert-high)" }}>
              {account.marginUtilizationRate >= 0.7
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
              ¥{formatNumber(account.availableMargin)}
            </div>
          </div>
        </div>

        <div className="text-xs mt-3" style={{ color: "var(--foreground-subtle)" }}>
          快照时间 {formatRelativeTime(account.snapshotAt)}
        </div>
      </div>
    </div>
  );
}

// ─── Z-Score Mini Progress Bar ───────────────────────────────────────────────

function ZScoreMiniBar({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  // Show how close current Z-score is to target
  // Range: -3σ to +3σ
  const range = 3;
  const pct = Math.min(100, Math.max(0, ((current - -range) / (range - -range)) * 100));
  const targetPct = Math.min(100, Math.max(0, ((target - -range) / (range - -range)) * 100));
  const barColor =
    Math.abs(current) > 2
      ? "var(--alert-critical)"
      : Math.abs(current) > 1.5
      ? "var(--alert-high)"
      : "var(--accent-primary)";

  return (
    <div className="w-16">
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-overlay)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="relative h-1.5 -mt-1.5">
        <div
          className="absolute w-0.5 h-2 -mt-0.5 rounded-full"
          style={{
            left: `${targetPct}%`,
            background: "var(--foreground-subtle)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Position Row ─────────────────────────────────────────────────────────────

function PositionRow({
  position,
  onClick,
  onDelete,
}: {
  position: PositionGroup;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const health = calculatePositionHealth(position);
  const healthColor =
    health.status === "healthy"
      ? "var(--positive)"
      : health.status === "warning"
      ? "var(--alert-medium)"
      : "var(--alert-critical)";
  const healthBg =
    health.status === "healthy"
      ? "var(--positive-muted)"
      : health.status === "warning"
      ? "var(--alert-medium-muted)"
      : "var(--alert-critical-muted)";

  return (
    <tr
      onClick={onClick}
      className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {position.strategyName}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
              {position.legs.map((l) => l.asset).join(" / ")}
            </div>
          </div>
          {/* Health score badge */}
          <div
            className="ml-auto shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: healthBg }}
            title={`健康分 ${health.healthScore} (${health.status === "healthy" ? "健康" : health.status === "warning" ? "警告" : "危险"})`}
          >
            <span className="text-xs font-bold font-mono" style={{ color: healthColor }}>
              {health.healthScore}
            </span>
          </div>
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
        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            目标 {position.targetZScore > 0 ? "+" : ""}{position.targetZScore}σ
          </span>
          <ZScoreMiniBar current={position.currentZScore} target={position.targetZScore} />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono" style={{ color: "var(--foreground)" }}>
          {position.daysHeld}天
        </span>
        {position.halfLifeDays > 0 && (
          <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
            / {position.halfLifeDays.toFixed(1)}天
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: healthBg,
            color: healthColor,
          }}
        >
          {health.status === "healthy" ? "健康" : health.status === "warning" ? "警告" : "危险"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm("确定删除此持仓？")) onDelete(position.id); }}
          className="text-xs px-2 py-0.5 rounded transition-colors"
          style={{ color: "var(--negative)", background: "var(--negative-muted)" }}
        >
          删除
        </button>
      </td>
    </tr>
  );
}

// ─── Position Detail ──────────────────────────────────────────────────────────

function PositionDetail({
  position,
}: {
  position: PositionGroup;
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
        <div className="text-sm font-mono mt-0.5" style={{ color: "var(--accent-primary)" }}>
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

// ─── Positions Page ───────────────────────────────────────────────────────────

export default function PositionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [positions, setPositions] = useState<PositionGroup[]>([]);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());
  const [varResult, setVarResult] = useState<VaRResult | null>(null);
  const [stressResults, setStressResults] = useState<StressTestResult[]>([]);
  const [correlationMatrix, setCorrelationMatrix] = useState<CorrelationMatrix | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPos, setNewPos] = useState({ leg1: "RB", leg2: "HC", direction: "long" as "long" | "short", size: 10, entrySpread: 0, marginPerLeg: 50000 });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPositions(),
      getAccountSnapshot(),
      getRiskVaR(),
      getStressTest(),
      getCorrelationMatrix(),
    ]).then(([pos, acc, vr, st, cm]) => {
      setPositions(pos);
      setAccount(acc);
      setVarResult(vr);
      setStressResults(st ?? []);
      setCorrelationMatrix(cm);
      setUpdatedAt(new Date().toISOString());
      setLoading(false);
    }).catch((err) => {
      console.error("Positions load error:", err);
      setLoading(false);
    });
  }, []);

  async function handleCreatePosition() {
    setCreating(true);
    try {
      const legs = newPos.leg2
        ? [
            { asset: newPos.leg1, direction: newPos.direction, size: newPos.size, marginUsed: newPos.marginPerLeg },
            { asset: newPos.leg2, direction: newPos.direction === "long" ? "short" as const : "long" as const, size: newPos.size, marginUsed: newPos.marginPerLeg },
          ]
        : [{ asset: newPos.leg1, direction: newPos.direction, size: newPos.size, marginUsed: newPos.marginPerLeg }];

      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legs,
          entrySpread: newPos.entrySpread,
          spreadUnit: "元/吨",
          exitCondition: "z_score_revert",
          strategyName: `手动建仓 ${newPos.leg1}${newPos.leg2 ? "/" + newPos.leg2 : ""}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPositions((prev) => [data.data, ...prev]);
          setShowNewForm(false);
        }
      }
    } catch (err) {
      console.error("Create position error:", err);
    }
    setCreating(false);
  }

  const selectedPosition = selectedId
    ? positions.find((p) => p.id === selectedId)
    : null;

  const openPositions = positions.filter((p) => p.status === "open");
  const closedPositions = positions.filter(
    (p) => p.status === "closed" || p.status === "partially_closed"
  );

  // Compute risk metrics and exit signals
  const riskMetrics = useMemo(
    () =>
      account
        ? calculatePortfolioRisk(openPositions, account, closedPositions)
        : null,
    [openPositions, closedPositions, account]
  );

  const exitSignals = useMemo(
    () => detectExitSignals(openPositions),
    [openPositions]
  );

  // Historical analytics
  const historicalData = useMemo(() => {
    const cumPnL = buildCumulativePnL(closedPositions);
    const drawdown = buildDrawdownSeries(cumPnL);
    return { cumPnL, drawdown };
  }, [closedPositions]);

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
              {loading ? "加载中…" : `${openPositions.length} 个活跃组合 · 更新于 ${formatRelativeTime(updatedAt)}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab toggle */}
          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ background: "var(--surface-overlay)" }}
          >
            {[
              { key: "open", label: "持仓中", count: openPositions.length },
              { key: "history", label: "历史", count: closedPositions.length },
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
                    style={{ background: "var(--accent-primary)", color: "#fff" }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: "var(--accent-primary)", color: "#fff" }}
            >
              + 新建持仓
            </button>
          </div>
        </div>
      </div>

      {/* New position form */}
      {showNewForm && (
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>新建持仓</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>品种1</label>
              <select className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.leg1} onChange={(e) => setNewPos((p) => ({ ...p, leg1: e.target.value }))}>
                {Object.entries(COMMODITY_NAME_MAP).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>品种2（可选）</label>
              <select className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.leg2} onChange={(e) => setNewPos((p) => ({ ...p, leg2: e.target.value }))}>
                <option value="">无（单品种）</option>
                {Object.entries(COMMODITY_NAME_MAP).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>方向</label>
              <select className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.direction} onChange={(e) => setNewPos((p) => ({ ...p, direction: e.target.value as "long" | "short" }))}>
                <option value="long">做多</option>
                <option value="short">做空</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>手数</label>
              <input type="number" className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.size} onChange={(e) => setNewPos((p) => ({ ...p, size: parseInt(e.target.value) || 1 }))} min={1} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>开仓价差</label>
              <input type="number" className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.entrySpread} onChange={(e) => setNewPos((p) => ({ ...p, entrySpread: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>每腿保证金 (¥)</label>
              <input type="number" className="w-full px-2 py-1.5 rounded text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }} value={newPos.marginPerLeg} onChange={(e) => setNewPos((p) => ({ ...p, marginPerLeg: parseInt(e.target.value) || 0 }))} min={0} step={10000} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreatePosition} disabled={creating} className="px-4 py-1.5 rounded text-xs font-medium" style={{ background: "var(--accent-primary)", color: "#fff", opacity: creating ? 0.6 : 1 }}>
              {creating ? "创建中..." : "确认创建"}
            </button>
            <button onClick={() => setShowNewForm(false)} className="px-4 py-1.5 rounded text-xs" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}>
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0 px-5 py-5">
        {activeTab === "open" && (
          <>
            <AccountSummary account={account} />

            {riskMetrics && <RiskMetricsDashboard metrics={riskMetrics} />}

            {/* VaR / Stress / Correlation panels */}
            {(varResult || stressResults.length > 0 || correlationMatrix) && (
              <div className="mb-6 flex flex-col gap-4">
                {/* VaR/CVaR cards */}
                {varResult && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {[
                      { label: "VaR (95%)", value: varResult.var95, color: "var(--alert-high)" },
                      { label: "VaR (99%)", value: varResult.var99, color: "var(--alert-critical)" },
                      { label: "CVaR (95%)", value: varResult.cvar95, color: "var(--alert-high)" },
                      { label: "CVaR (99%)", value: varResult.cvar99, color: "var(--alert-critical)" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>{m.label}</div>
                        <div className="text-sm font-semibold font-mono" style={{ color: m.color }}>
                          ¥{formatNumber(m.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stress test table */}
                {stressResults.length > 0 && (
                  <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>压力测试</span>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <th className="px-4 py-2 text-left text-xs" style={{ color: "var(--foreground-subtle)" }}>场景</th>
                          <th className="px-4 py-2 text-left text-xs" style={{ color: "var(--foreground-subtle)" }}>描述</th>
                          <th className="px-4 py-2 text-right text-xs" style={{ color: "var(--foreground-subtle)" }}>组合 P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stressResults.slice(0, 5).map((s) => (
                          <tr key={s.scenario} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                            <td className="px-4 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>{s.scenario}</td>
                            <td className="px-4 py-2 text-xs" style={{ color: "var(--foreground-muted)" }}>{s.description}</td>
                            <td className="px-4 py-2 text-right text-sm font-mono font-semibold" style={{ color: s.portfolioPnl >= 0 ? "var(--positive)" : "var(--negative)" }}>
                              {s.portfolioPnl >= 0 ? "+" : ""}¥{formatNumber(s.portfolioPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Correlation matrix */}
                {correlationMatrix && correlationMatrix.symbols.length > 0 && (
                  <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>相关性矩阵</span>
                    </div>
                    <div className="overflow-x-auto p-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="px-2 py-1" />
                            {correlationMatrix.symbols.map((s) => (
                              <th key={s} className="px-2 py-1 font-mono text-center" style={{ color: "var(--accent-primary)" }}>{s}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {correlationMatrix.symbols.map((row, i) => (
                            <tr key={row}>
                              <td className="px-2 py-1 font-mono font-medium" style={{ color: "var(--accent-primary)" }}>{row}</td>
                              {(correlationMatrix.matrix[i] ?? []).map((val, j) => {
                                const abs = Math.abs(val);
                                const bg = i === j ? "transparent"
                                  : val > 0 ? `rgba(63,185,80,${abs * 0.4})`
                                  : `rgba(248,81,73,${abs * 0.4})`;
                                return (
                                  <td key={j} className="px-2 py-1 text-center font-mono" style={{ background: bg, color: "var(--foreground)" }}>
                                    {val.toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <ExitSignalsBanner
              signals={exitSignals}
              onSignalClick={(id) => openPosition(id)}
            />

            {loading ? (
              <div
                className="rounded-lg overflow-hidden animate-pulse"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex-1">
                      <div className="h-4 w-2/3 rounded mb-1" style={{ background: "var(--surface-overlay)" }} />
                      <div className="h-3 w-1/3 rounded" style={{ background: "var(--surface-overlay)" }} />
                    </div>
                    <div className="h-4 w-16 rounded" style={{ background: "var(--surface-overlay)" }} />
                    <div className="h-4 w-16 rounded" style={{ background: "var(--surface-overlay)" }} />
                    <div className="h-4 w-12 rounded" style={{ background: "var(--surface-overlay)" }} />
                    <div className="h-5 w-14 rounded" style={{ background: "var(--surface-overlay)" }} />
                  </div>
                ))}
              </div>
            ) : (
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
                        健康
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((pos) => (
                      <PositionRow
                        key={pos.id}
                        position={pos}
                        onClick={() => openPosition(pos.id)}
                        onDelete={async (id) => {
                          const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
                          if (res.ok) setPositions((prev) => prev.filter((p) => p.id !== id));
                        }}
                      />
                    ))}
                    {!loading && openPositions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--foreground-subtle)" }}>
                          暂无活跃持仓
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "history" && (
          <div className="flex flex-col gap-4">
            {loading ? (
              <div
                className="rounded-lg p-5 animate-pulse"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="h-4 w-32 rounded mb-4" style={{ background: "var(--surface-overlay)" }} />
                <div className="h-40 w-full rounded" style={{ background: "var(--surface-overlay)" }} />
              </div>
            ) : (
              <HistoricalChart
                cumulativePnL={historicalData.cumPnL}
                drawdownSeries={historicalData.drawdown}
              />
            )}

            {closedPositions.length > 0 && !loading && (
              <div
                className="rounded-lg overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground-subtle)" }}>
                    历史持仓 ({closedPositions.length})
                  </span>
                </div>
                {closedPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-[var(--surface-raised)] transition-colors"
                    style={{ borderColor: "var(--border-subtle)" }}
                    onClick={() => openPosition(pos.id)}
                  >
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                        {pos.strategyName}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
                        {pos.legs.map((l) => l.asset).join(" / ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <PnlBadge value={pos.realizedPnl ?? 0} />
                      <div className="text-xs mt-0.5" style={{ color: "var(--foreground-subtle)" }}>
                        {formatRelativeTime(pos.closedAt ?? pos.openedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
