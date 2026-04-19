import type { StrategyPoolItem, Hypothesis, SpreadHypothesis, DirectionalHypothesis, Recommendation, PositionGroup, Alert } from "@/types/domain";
import { STRATEGY_STATUS_LABEL, RECOMMENDATION_STATUS_LABEL, RECOMMENDED_ACTION_LABEL, SEVERITY_LABEL } from "@/lib/constants";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getPositions, getRecommendations, getAlerts, runBacktestClient, runCausalValidationClient } from "@/lib/api-client";
import { useState, useEffect } from "react";
import type { BacktestResult, CausalResult } from "@/lib/backtest/client";

interface StrategyDetailProps {
  strategy: StrategyPoolItem;
  onStatusChange?: (id: string) => void;
  onDelete?: (id: string) => void;
  refresh?: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--foreground-subtle)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function StrategyDetail({
  strategy,
  onStatusChange,
  onDelete,
  refresh,
}: StrategyDetailProps) {
  const router = useRouter();
  const h = (strategy.hypothesis ?? {}) as Hypothesis;
  const v = strategy.validation;
  const [linkedPositions, setLinkedPositions] = useState<PositionGroup[]>([]);
  const [linkedRecs, setLinkedRecs] = useState<Recommendation[]>([]);
  const [linkedAlerts, setLinkedAlerts] = useState<Alert[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [causalResult, setCausalResult] = useState<CausalResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [causalLoading, setCausalLoading] = useState(false);

  useEffect(() => {
    getPositions({ status: "open" }).then((positions) => {
      setLinkedPositions(positions.filter((p) => p.strategyId === strategy.id));
    });
    getRecommendations().then((recs) => {
      setLinkedRecs(recs.filter((r) => r.strategyId === strategy.id));
    });
    getAlerts().then((alerts) => {
      setLinkedAlerts(alerts.filter((a) =>
        a.relatedStrategyId === strategy.id || strategy.relatedAlertIds.includes(a.id)
      ));
    });
  }, [strategy.id, strategy.relatedAlertIds]);

  async function handleRunBacktest() {
    setBacktestLoading(true);
    const legs = h.type === "spread" && (h as SpreadHypothesis).legs
      ? (h as SpreadHypothesis).legs.map((l) => ({ asset: l.asset, direction: l.direction, ratio: l.ratio }))
      : h.type === "directional" && (h as DirectionalHypothesis).leg
      ? [{ asset: (h as DirectionalHypothesis).leg.asset, direction: (h as DirectionalHypothesis).leg.direction, ratio: 1 }]
      : [];
    const result = await runBacktestClient({
      hypothesis_id: strategy.id,
      legs,
      prices: {},
      dates: [],
    });
    setBacktestResult(result);
    setBacktestLoading(false);
  }

  async function handleRunCausal() {
    setCausalLoading(true);
    const assets = h.type === "spread"
      ? (h as SpreadHypothesis).legs.map((l) => l.asset)
      : [(h as DirectionalHypothesis).leg.asset];
    const result = await runCausalValidationClient({
      hypothesis_id: strategy.id,
      treatment: assets[0],
      outcome: assets[1] ?? assets[0],
      prices: {},
      dates: [],
    });
    setCausalResult(result);
    setCausalLoading(false);
  }

  const hasPositions = linkedPositions.length > 0;

  const isActive = strategy.status === "active" || strategy.status === "approaching_trigger";

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
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
          {h.type === "spread" ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            >
              {(h as SpreadHypothesis).spreadModel.replace(/_/g, " ")}
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
            >
              方向性 {(h as DirectionalHypothesis).leg.direction === "long" ? "做多" : "做空"}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            {h.type === "spread" ? "价差策略" : "方向性策略"}
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: "var(--foreground)" }}>
          {strategy.name}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {strategy.description}
        </p>
      </div>

      {/* Legs */}
      {h.type === "spread" ? (
        <Section title="套利组合">
          <div className="flex flex-col gap-2">
            {(h as SpreadHypothesis).legs.map((leg, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-4 py-3"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
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
                <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  {leg.exchange}
                </span>
                <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>
                  配比 {leg.ratio}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="方向性持仓">
          <div className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <span
              className="text-xs font-bold px-2 py-0.5 rounded font-mono"
              style={{
                background: (h as DirectionalHypothesis).leg.direction === "long" ? "var(--positive-muted)" : "var(--negative-muted)",
                color: (h as DirectionalHypothesis).leg.direction === "long" ? "var(--positive)" : "var(--negative)",
              }}
            >
              {(h as DirectionalHypothesis).leg.direction === "long" ? "做多" : "做空"}
            </span>
            <span className="font-mono font-medium text-sm" style={{ color: "var(--foreground)" }}>
              {(h as DirectionalHypothesis).leg.asset}
            </span>
            <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              {(h as DirectionalHypothesis).leg.exchange}
            </span>
            {(h as DirectionalHypothesis).positionSize && (
              <span className="ml-auto text-xs" style={{ color: "var(--foreground-muted)" }}>
                {(h as DirectionalHypothesis).positionSize} 手
              </span>
            )}
          </div>
        </Section>
      )}

      {/* Hypothesis metrics */}
      {h.type === "spread" ? (
        <Section title="假设检验">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>当前 Z-Score</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{
                  color:
                    Math.abs((h as SpreadHypothesis).currentZScore) > 2
                      ? "var(--alert-critical)"
                      : Math.abs((h as SpreadHypothesis).currentZScore) > 1.5
                      ? "var(--alert-high)"
                      : "var(--foreground)",
                }}
              >
                {(h as SpreadHypothesis).currentZScore > 0 ? "+" : ""}{(h as SpreadHypothesis).currentZScore.toFixed(2)}σ
              </div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>半衰期</div>
              <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                ~{(h as SpreadHypothesis).halfLife}天
              </div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>因果置信度</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{
                  color: ((h as SpreadHypothesis).causalConfidence ?? 0) > 0.7 ? "var(--positive)" : "var(--foreground)",
                }}
              >
                {formatConfidence((h as SpreadHypothesis).causalConfidence ?? 0)}
              </div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>ADF p-value</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{ color: (h as SpreadHypothesis).adfPValue < 0.05 ? "var(--positive)" : "var(--foreground-muted)" }}
              >
                {(h as SpreadHypothesis).adfPValue.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--foreground-muted)" }}>入场阈值</span>
              <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                {(h as SpreadHypothesis).entryThreshold > 0 ? "+" : ""}{(h as SpreadHypothesis).entryThreshold}σ
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span style={{ color: "var(--foreground-muted)" }}>出场阈值</span>
              <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                {(h as SpreadHypothesis).exitThreshold > 0 ? "+" : ""}{(h as SpreadHypothesis).exitThreshold}σ
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span style={{ color: "var(--foreground-muted)" }}>止损阈值</span>
              <span className="font-mono font-medium" style={{ color: "var(--negative)" }}>
                {(h as SpreadHypothesis).stopLossThreshold > 0 ? "+" : ""}{(h as SpreadHypothesis).stopLossThreshold}σ
              </span>
            </div>
          </div>
        </Section>
      ) : (
        <Section title="交易信号">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>置信度</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{
                  color: ((h as DirectionalHypothesis).confidence ?? 0) > 0.7 ? "var(--positive)" : "var(--foreground)",
                }}
              >
                {formatConfidence((h as DirectionalHypothesis).confidence ?? 0)}
              </div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>风险回报</div>
              <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                {(h as DirectionalHypothesis).riskRewardRatio?.toFixed(2) ?? "—"}
              </div>
            </div>
          </div>

          {/* Price levels */}
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {(h as DirectionalHypothesis).currentPrice && (
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--foreground-muted)" }}>当前价格</span>
                <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                  {(h as DirectionalHypothesis).currentPrice?.toLocaleString()}
                </span>
              </div>
            )}
            {(h as DirectionalHypothesis).stopLoss && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span style={{ color: "var(--foreground-muted)" }}>止损价格</span>
                <span className="font-mono font-medium" style={{ color: "var(--negative)" }}>
                  {(h as DirectionalHypothesis).stopLoss?.toLocaleString()}
                </span>
              </div>
            )}
            {(h as DirectionalHypothesis).takeProfit && (
              <div className="flex items-center justify-between text-sm mt-2">
                <span style={{ color: "var(--foreground-muted)" }}>止盈价格</span>
                <span className="font-mono font-medium" style={{ color: "var(--positive)" }}>
                  {(h as DirectionalHypothesis).takeProfit?.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Validation metrics */}
      <Section title="验证指标">
        <div className="space-y-3">
          <div
            className="flex items-center gap-3"
          >
            <span className="text-xs w-16 shrink-0" style={{ color: "var(--foreground-muted)" }}>命中率</span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ background: "var(--surface-overlay)", height: "4px" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(v.hitRate * 100)}%`,
                  background: v.hitRate > 0.7 ? "var(--positive)" : "var(--accent-primary)",
                }}
              />
            </div>
            <span className="text-xs w-12 text-right font-mono" style={{ color: "var(--foreground)" }}>
              {(v.hitRate * 100).toFixed(0)}%
            </span>
          </div>
          <div
            className="flex items-center gap-3"
          >
            <span className="text-xs w-16 shrink-0" style={{ color: "var(--foreground-muted)" }}>夏普</span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ background: "var(--surface-overlay)", height: "4px" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((v.sharpeRatio ?? 0) / 2 * 100, 100)}%`,
                  background: (v.sharpeRatio ?? 0) > 1.5 ? "var(--positive)" : "var(--accent-primary)",
                }}
              />
            </div>
            <span className="text-xs w-12 text-right font-mono" style={{ color: "var(--foreground)" }}>
              {v.sharpeRatio?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>
        <div
          className="grid grid-cols-2 gap-2 mt-4"
        >
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>样本数</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {v.sampleCount} 次
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>平均持仓</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {v.avgHoldingDays} 天
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>费损比</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {v.costSpreadRatio.toFixed(2)}
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>压力损失</div>
            <div className="text-sm font-medium font-mono" style={{ color: "var(--negative)" }}>
              ¥{v.stressLoss.toLocaleString()}
            </div>
          </div>
        </div>
      </Section>

      {/* Backtest & Causal Validation */}
      <Section title="回测 & 因果验证">
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleRunBacktest}
            disabled={backtestLoading}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              background: backtestLoading ? "var(--surface-overlay)" : "var(--accent-primary)",
              color: backtestLoading ? "var(--foreground-subtle)" : "#fff",
              border: "1px solid var(--border)",
            }}
          >
            {backtestLoading ? "运行中…" : "运行回测"}
          </button>
          <button
            onClick={handleRunCausal}
            disabled={causalLoading}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              background: causalLoading ? "var(--surface-overlay)" : "var(--surface)",
              color: causalLoading ? "var(--foreground-subtle)" : "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {causalLoading ? "验证中…" : "因果验证"}
          </button>
        </div>

        {backtestResult && (
          <div className="rounded-lg p-3 mb-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>回测结果</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={{ color: "var(--foreground-subtle)" }}>Sharpe</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{backtestResult.sharpe_ratio.toFixed(2)}</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>最大回撤</span><div className="font-mono font-medium" style={{ color: "var(--negative)" }}>{(backtestResult.max_drawdown * 100).toFixed(1)}%</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>胜率</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{(backtestResult.win_rate * 100).toFixed(0)}%</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>IC</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{backtestResult.ic.toFixed(3)}</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>Calmar</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{backtestResult.calmar_ratio.toFixed(2)}</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>盈亏比</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{backtestResult.profit_factor.toFixed(2)}</div></div>
            </div>
          </div>
        )}

        {causalResult && (
          <div className="rounded-lg p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>因果验证结果</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={{ color: "var(--foreground-subtle)" }}>因果效应</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{causalResult.causal_effect.toFixed(4)}</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>p-value</span><div className="font-mono font-medium" style={{ color: causalResult.p_value < 0.05 ? "var(--positive)" : "var(--foreground-muted)" }}>{causalResult.p_value.toFixed(4)}</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>置信区间</span><div className="font-mono font-medium" style={{ color: "var(--foreground)" }}>[{causalResult.confidence_interval[0].toFixed(3)}, {causalResult.confidence_interval[1].toFixed(3)}]</div></div>
              <div><span style={{ color: "var(--foreground-subtle)" }}>反驳检验</span><div className="font-mono font-medium" style={{ color: causalResult.refutation_passed ? "var(--positive)" : "var(--negative)" }}>{causalResult.refutation_passed ? "通过" : "未通过"}</div></div>
            </div>
          </div>
        )}
      </Section>

      {/* Metadata */}
      <Section title="元信息">
        <div
          className="rounded-lg px-4 py-3 space-y-2"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--foreground-muted)" }}>创建时间</span>
            <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              {formatRelativeTime(strategy.createdAt)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "var(--foreground-muted)" }}>最后更新</span>
            <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              {formatRelativeTime(strategy.updatedAt)}
            </span>
          </div>
          {strategy.lastActivatedAt && (
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--foreground-muted)" }}>最后激活</span>
              <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {formatRelativeTime(strategy.lastActivatedAt)}
              </span>
            </div>
          )}
          {strategy.notes && (
            <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                {strategy.notes}
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* Linked Recommendations */}
      {linkedRecs.length > 0 && (
        <Section title={`关联推荐 (${linkedRecs.length})`}>
          <div className="flex flex-col gap-2">
            {linkedRecs.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg px-3 py-2.5 cursor-pointer hover:brightness-110"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                onClick={() => router.push("/recommendations")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}>
                    {RECOMMENDED_ACTION_LABEL[rec.recommendedAction]}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)" }}>
                    {RECOMMENDATION_STATUS_LABEL[rec.status]}
                  </span>
                  <span className="ml-auto text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {formatRelativeTime(rec.createdAt)}
                  </span>
                </div>
                <div className="text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
                  {rec.legs.map((l) => l.asset).join(" / ")}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Linked Positions */}
      {linkedPositions.length > 0 && (
        <Section title={`关联持仓 (${linkedPositions.length})`}>
          <div className="flex flex-col gap-2">
            {linkedPositions.map((pos) => (
              <div
                key={pos.id}
                className="rounded-lg px-3 py-2.5 cursor-pointer hover:brightness-110"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                onClick={() => router.push("/positions")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-medium" style={{ color: "var(--foreground)" }}>
                    {pos.legs.map((l) => l.asset).join(" / ")}
                  </span>
                  <span
                    className="ml-auto text-sm font-mono font-medium"
                    style={{ color: pos.unrealizedPnl >= 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    {pos.unrealizedPnl >= 0 ? "+" : ""}¥{pos.unrealizedPnl.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                  持仓 {pos.daysHeld} 天 · Z-Score {pos.currentZScore.toFixed(2)}σ
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Linked Alerts */}
      {linkedAlerts.length > 0 && (
        <Section title={`关联预警 (${linkedAlerts.length})`}>
          <div className="flex flex-col gap-2">
            {linkedAlerts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg px-3 py-2.5 cursor-pointer hover:brightness-110"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                onClick={() => router.push("/alerts")}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{
                      background: a.severity === "critical" ? "var(--alert-critical-muted)" : a.severity === "high" ? "var(--alert-high-muted)" : "var(--surface-overlay)",
                      color: a.severity === "critical" ? "var(--alert-critical)" : a.severity === "high" ? "var(--alert-high)" : "var(--foreground-muted)",
                    }}
                  >
                    {SEVERITY_LABEL[a.severity]}
                  </span>
                  <span className="text-xs truncate flex-1" style={{ color: "var(--foreground-muted)" }}>
                    {a.title}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--foreground-subtle)" }}>
                    {formatRelativeTime(a.triggeredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => router.push("/positions")}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
          style={{
            background: hasPositions ? "var(--accent-primary)" : "var(--surface-overlay)",
            color: hasPositions ? "#fff" : "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          查看持仓
          {hasPositions && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full ml-1"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {linkedPositions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => router.push("/recommendations")}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          查看推荐
        </button>

        {/* Status toggle */}
        {onStatusChange && (
          <button
            onClick={() => onStatusChange(strategy.id)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
            style={{
              background: isActive ? "var(--negative-muted)" : "var(--positive-muted)",
              color: isActive ? "var(--negative)" : "var(--positive)",
              border: "1px solid var(--border)",
            }}
          >
            {isActive ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
                暂停策略
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                启用策略
              </>
            )}
          </button>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            onClick={() => onDelete(strategy.id)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded ml-auto transition-colors"
            style={{
              background: "transparent",
              color: "var(--negative)",
              border: "1px solid var(--border)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            删除
          </button>
        )}
      </div>
    </div>
  );
}
