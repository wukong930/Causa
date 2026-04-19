import type { PortfolioRiskMetrics } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

interface RiskMetricsDashboardProps {
  metrics: PortfolioRiskMetrics;
}

function MetricCard({
  label,
  value,
  unit,
  trend,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  const trendColors = {
    up: "var(--positive)",
    down: "var(--negative)",
    neutral: "var(--foreground-muted)",
  };
  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-lg font-semibold font-mono"
          style={{ color: color ?? "var(--foreground)" }}
        >
          {typeof value === "number" ? formatNumber(value) : value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            {unit}
          </span>
        )}
      </div>
      {trend && (
        <div className="text-xs mt-1" style={{ color: trendColors[trend] }}>
          {trendIcons[trend]}
        </div>
      )}
    </div>
  );
}

function ConcentrationBar({
  category,
  amount,
  total,
}: {
  category: string;
  amount: number;
  total: number;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const colorMap: Record<string, string> = {
    黑色: "var(--accent-primary)",
    有色: "var(--accent-orange)",
    能化: "var(--accent-purple)",
    农产品: "var(--accent-green)",
    海外: "var(--accent-gold)",
    其他: "var(--foreground-muted)",
  };

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-12 shrink-0">
        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {category}
        </span>
      </div>
      <div className="flex-1">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "var(--surface-overlay)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct.toFixed(1)}%`,
              background: colorMap[category] ?? "var(--foreground-muted)",
            }}
          />
        </div>
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className="text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
          ¥{formatNumber(amount)}
        </span>
      </div>
      <div className="w-12 shrink-0 text-right">
        <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function RiskMetricsDashboard({ metrics }: RiskMetricsDashboardProps) {
  const totalMargin = Object.values(metrics.concentrationRisk).reduce(
    (s, v) => s + v,
    0
  );

  const sharpeColor =
    metrics.sharpeRatio >= 1.5
      ? "var(--positive)"
      : metrics.sharpeRatio >= 0.8
      ? "var(--alert-medium)"
      : metrics.sharpeRatio >= 0
      ? "var(--foreground)"
      : "var(--negative)";

  const leverageColor =
    metrics.leverageRatio >= 0.8
      ? "var(--alert-critical)"
      : metrics.leverageRatio >= 0.5
      ? "var(--alert-high)"
      : "var(--positive)";

  return (
    <div className="mb-6">
      {/* 4-metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="Sharpe 比率"
          value={metrics.sharpeRatio.toFixed(2)}
          trend={metrics.sharpeRatio > 0 ? "up" : metrics.sharpeRatio < 0 ? "down" : "neutral"}
          color={sharpeColor}
        />
        <MetricCard
          label="最大回撤"
          value={metrics.maxDrawdown < 0 ? "-" + formatNumber(Math.abs(metrics.maxDrawdown)) : "0"}
          unit="¥"
          color={metrics.maxDrawdown < 0 ? "var(--negative)" : "var(--positive)"}
        />
        <MetricCard
          label="杠杆率"
          value={(metrics.leverageRatio * 100).toFixed(1)}
          unit="%"
          color={leverageColor}
        />
        <MetricCard
          label="胜率"
          value={(metrics.winRate * 100).toFixed(0)}
          unit="%"
          trend={
            metrics.winRate >= 0.55
              ? "up"
              : metrics.winRate <= 0.4
              ? "down"
              : "neutral"
          }
          color={
            metrics.winRate >= 0.55
              ? "var(--positive)"
              : metrics.winRate <= 0.4
              ? "var(--negative)"
              : "var(--foreground)"
          }
        />
      </div>

      {/* Concentration breakdown */}
      {Object.keys(metrics.concentrationRisk).length > 0 && (
        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>
            品种保证金分布
          </div>
          <div className="flex flex-col gap-0.5">
            {Object.entries(metrics.concentrationRisk)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => (
                <ConcentrationBar
                  key={cat}
                  category={cat}
                  amount={amount}
                  total={totalMargin}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
