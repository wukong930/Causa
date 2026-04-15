import type { StrategyPoolItem } from "@/types/domain";
import { STRATEGY_STATUS_LABEL } from "@/lib/constants";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { mockPositionSnapshot } from "@/mocks/positions";

interface StrategyDetailProps {
  strategy: StrategyPoolItem;
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

export function StrategyDetail({ strategy }: StrategyDetailProps) {
  const router = useRouter();
  const h = strategy.hypothesis;
  const v = strategy.validation;

  // Check if this strategy has active positions
  const hasPositions = mockPositionSnapshot.positions.some(
    (p) => p.strategyId === strategy.id
  );

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
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            {h.spreadModel.replace(/_/g, " ")}
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
      <Section title="套利组合">
        <div className="flex flex-col gap-2">
          {h.legs.map((leg, i) => (
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

      {/* Hypothesis metrics */}
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
                  Math.abs(h.currentZScore) > 2
                    ? "var(--alert-critical)"
                    : Math.abs(h.currentZScore) > 1.5
                    ? "var(--alert-high)"
                    : "var(--foreground)",
              }}
            >
              {h.currentZScore > 0 ? "+" : ""}{h.currentZScore.toFixed(2)}σ
            </div>
          </div>
          <div
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>半衰期</div>
            <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
              ~{h.halfLife}天
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
                color: (h.causalConfidence ?? 0) > 0.7 ? "var(--positive)" : "var(--foreground)",
              }}
            >
              {formatConfidence(h.causalConfidence ?? 0)}
            </div>
          </div>
          <div
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>ADF p-value</div>
            <div
              className="text-xl font-semibold font-mono"
              style={{ color: h.adfPValue < 0.05 ? "var(--positive)" : "var(--foreground-muted)" }}
            >
              {h.adfPValue.toFixed(3)}
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
              {h.entryThreshold > 0 ? "+" : ""}{h.entryThreshold}σ
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span style={{ color: "var(--foreground-muted)" }}>出场阈值</span>
            <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {h.exitThreshold > 0 ? "+" : ""}{h.exitThreshold}σ
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span style={{ color: "var(--foreground-muted)" }}>止损阈值</span>
            <span className="font-mono font-medium" style={{ color: "var(--negative)" }}>
              {h.stopLossThreshold > 0 ? "+" : ""}{h.stopLossThreshold}σ
            </span>
          </div>
        </div>
      </Section>

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
                  background: v.hitRate > 0.7 ? "var(--positive)" : "var(--accent-blue)",
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
                  background: (v.sharpeRatio ?? 0) > 1.5 ? "var(--positive)" : "var(--accent-blue)",
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

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => router.push("/positions")}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
          style={{
            background: hasPositions ? "var(--accent-blue)" : "var(--surface-overlay)",
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
              {mockPositionSnapshot.positions.filter((p) => p.strategyId === strategy.id).length}
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
      </div>
    </div>
  );
}
