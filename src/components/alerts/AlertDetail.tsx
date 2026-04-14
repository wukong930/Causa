import type { Alert } from "@/types/domain";
import { SeverityBadge, CategoryBadge } from "@/components/shared/Badges";
import { formatRelativeTime, formatConfidence, clsx } from "@/lib/utils";

interface AlertDetailProps {
  alert: Alert;
  onAddToWatch?: () => void;
  onMoveToSetup?: () => void;
  onInvalidate?: () => void;
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

function RiskItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 mt-0.5"
        style={{ color: "var(--alert-high)" }}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{text}</span>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <label className="flex items-start gap-2.5 py-1.5 cursor-pointer group">
      <input
        type="checkbox"
        className="mt-0.5 shrink-0 accent-[var(--accent-blue)]"
      />
      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{text}</span>
    </label>
  );
}

export function AlertDetail({ alert, onAddToWatch, onMoveToSetup, onInvalidate }: AlertDetailProps) {
  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <SeverityBadge severity={alert.severity} size="md" />
          <CategoryBadge category={alert.category} />
          <span className="text-xs ml-auto" style={{ color: "var(--foreground-subtle)" }}>
            {formatRelativeTime(alert.triggeredAt)}
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: "var(--foreground)" }}>
          {alert.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {alert.summary}
        </p>
      </div>

      {/* Related assets */}
      <div className="flex items-center gap-2 mb-5">
        {alert.relatedAssets.map((a) => (
          <span
            key={a}
            className="text-sm px-2 py-1 rounded font-mono font-medium"
            style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)", border: "1px solid var(--border)" }}
          >
            {a}
          </span>
        ))}
        <span className="ml-auto text-sm" style={{ color: "var(--foreground-muted)" }}>
          置信度{" "}
          <strong style={{ color: "var(--foreground)" }}>{formatConfidence(alert.confidence)}</strong>
        </span>
      </div>

      {/* Spread info */}
      {alert.spreadInfo && (
        <Section title="价差信息">
          <div
            className="rounded-lg p-4 grid grid-cols-3 gap-4"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>当前价差</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{ color: alert.spreadInfo.currentSpread < 0 ? "var(--negative)" : "var(--positive)" }}
              >
                {alert.spreadInfo.currentSpread > 0 ? "+" : ""}{alert.spreadInfo.currentSpread}
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>{alert.spreadInfo.unit}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>历史均值</div>
              <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                {alert.spreadInfo.historicalMean}
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>{alert.spreadInfo.unit}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>Z-Score</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{ color: Math.abs(alert.spreadInfo.zScore) > 2 ? "var(--alert-critical)" : "var(--alert-high)" }}
              >
                {alert.spreadInfo.zScore.toFixed(1)}σ
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {alert.spreadInfo.leg1} / {alert.spreadInfo.leg2}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Trigger chain */}
      <Section title="触发链路">
        <div className="relative pl-4">
          {/* Vertical line */}
          <div
            className="absolute left-1.5 top-2 bottom-2 w-px"
            style={{ background: "var(--border)" }}
          />
          {alert.triggerChain.map((step, i) => (
            <div key={step.step} className="relative flex gap-3 mb-4 last:mb-0">
              {/* Step dot */}
              <div
                className="absolute -left-2.5 top-1 w-2 h-2 rounded-full border-2 shrink-0"
                style={{
                  background: i === 0 ? "var(--accent-blue)" : "var(--surface-raised)",
                  borderColor: i === 0 ? "var(--accent-blue)" : "var(--border)",
                }}
              />
              <div className="pl-2 flex-1">
                <div className="text-sm" style={{ color: "var(--foreground)" }}>
                  {step.description}
                </div>
                {step.evidence && (
                  <div
                    className="text-xs mt-0.5 font-mono px-1.5 py-0.5 rounded inline-block"
                    style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
                  >
                    {step.evidence}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Suggestion */}
      {alert.suggestion && (
        <Section title="建议表达">
          <div
            className="rounded-lg p-4 border-l-2"
            style={{
              background: "var(--surface-raised)",
              borderLeftColor: "var(--accent-blue)",
              border: "1px solid var(--border)",
              borderLeftWidth: "2px",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {alert.suggestion}
            </p>
          </div>
        </Section>
      )}

      {/* Invalidation condition */}
      <Section title="失效条件">
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            color: "var(--foreground-muted)",
          }}
        >
          {alert.invalidationCondition}
        </div>
      </Section>

      {/* Risk items */}
      {alert.riskItems.length > 0 && (
        <Section title="风险项">
          <div
            className="rounded-lg px-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {alert.riskItems.map((r) => (
              <RiskItem key={r} text={r} />
            ))}
          </div>
        </Section>
      )}

      {/* Manual check items */}
      {alert.manualCheckItems.length > 0 && (
        <Section title="人工确认清单">
          <div
            className="rounded-lg px-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {alert.manualCheckItems.map((c) => (
              <CheckItem key={c} text={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onAddToWatch}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
          style={{
            background: "var(--surface-overlay)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          加入关注
        </button>
        <button
          onClick={onMoveToSetup}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded transition-colors"
          style={{
            background: "var(--accent-blue-muted)",
            color: "var(--accent-blue)",
            border: "1px solid var(--accent-blue)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          转入策略池
        </button>
        <button
          onClick={onInvalidate}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded ml-auto transition-colors"
          style={{
            background: "transparent",
            color: "var(--foreground-subtle)",
            border: "1px solid var(--border)",
          }}
        >
          标记失效
        </button>
      </div>
    </div>
  );
}
