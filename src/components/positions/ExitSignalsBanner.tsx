import type { ExitSignal } from "@/lib/analytics";

interface ExitSignalsBannerProps {
  signals: ExitSignal[];
  onSignalClick?: (positionId: string) => void;
}

const SIGNAL_CONFIG = {
  approaching_exit: {
    label: "接近出场",
    bg: "var(--alert-high-muted)",
    color: "var(--alert-high)",
    icon: "🎯",
  },
  in_profit: {
    label: "浮动盈利",
    bg: "var(--positive-muted)",
    color: "var(--positive)",
    icon: "💰",
  },
  breakeven: {
    label: "盈亏平衡",
    bg: "var(--surface-overlay)",
    color: "var(--foreground-muted)",
    icon: "⚖",
  },
  at_loss: {
    label: "浮亏告警",
    bg: "var(--alert-critical-muted)",
    color: "var(--alert-critical)",
    icon: "⚠",
  },
};

export function ExitSignalsBanner({ signals, onSignalClick }: ExitSignalsBannerProps) {
  if (signals.length === 0) return null;

  // Show top 3 signals by confidence
  const topSignals = signals.slice(0, 3);

  return (
    <div
      className="rounded-lg px-4 py-3 mb-4"
      style={{
        background: "var(--alert-high-muted)",
        border: "1px solid var(--alert-high)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "var(--alert-high)" }}>🚨</span>
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--alert-high)" }}
        >
          出场信号 ({signals.length})
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {topSignals.map((signal) => {
          const config = SIGNAL_CONFIG[signal.signalType];
          return (
            <div
              key={signal.positionId}
              className="flex items-start gap-2 text-xs cursor-pointer rounded px-2 py-1.5 transition-colors"
              style={{
                background: "rgba(255,255,255,0.03)",
              }}
              onClick={() => onSignalClick?.(signal.positionId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSignalClick?.(signal.positionId);
                }
              }}
            >
              <span>{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-semibold shrink-0"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(0,0,0,0.1)", minWidth: 40 }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(signal.confidence * 100)}%`,
                        background: config.color,
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: "var(--foreground-subtle)" }}
                  >
                    {Math.round(signal.confidence * 100)}%
                  </span>
                </div>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {signal.reason}
                </p>
              </div>
              <span
                className="shrink-0 text-xs"
                style={{ color: "var(--foreground-subtle)" }}
              >
                ~{signal.daysToExit}天
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
