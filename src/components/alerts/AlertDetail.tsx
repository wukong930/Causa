"use client";

import type { Alert } from "@/types/domain";
import { ALERT_STATUS_LABEL, ALERT_TYPE_LABEL, getCommodityName } from "@/lib/constants";
import { SeverityBadge, CategoryBadge } from "@/components/shared/Badges";
import { formatRelativeTime, formatConfidence } from "@/lib/utils";

interface AlertDetailProps {
  alert: Alert;
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

function generatePlainSummary(alert: Alert): string {
  const si = alert.spreadInfo;
  if (alert.type === "spread_anomaly" && si) {
    const dir = si.currentSpread > si.historicalMean ? "高于" : "低于";
    const deviation = Math.abs(si.zScore).toFixed(1);
    return `${si.leg1} 和 ${si.leg2} 之间的价差目前${dir}历史平均水平，偏离程度达到 ${deviation} 个标准差。通俗地说，这种偏离在历史上比较少见，价差有较大概率会向均值回归。预计回归周期约 ${si.halfLife} 个交易日。`;
  }
  if (alert.type === "basis_shift" && si) {
    return `${si.leg1} 和 ${si.leg2} 的基差出现明显变化，当前价差 ${si.currentSpread.toFixed(0)}，偏离历史均值 ${si.historicalMean.toFixed(0)}。这可能意味着供需关系或市场结构正在发生变化，值得密切关注。`;
  }
  if (alert.type === "momentum") {
    return `检测到相关品种出现较强的价格动量信号，短期趋势可能延续。建议关注成交量变化和持仓量变动来确认趋势强度。`;
  }
  if (alert.type === "event_driven") {
    return `市场出现可能影响价格的重要事件。事件驱动的价格波动往往较为剧烈，建议关注事件后续发展和市场反应。`;
  }
  return alert.summary;
}

export function AlertDetail({
  alert,
}: AlertDetailProps) {
  const si = alert.spreadInfo;

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <SeverityBadge severity={alert.severity} size="md" />
          <CategoryBadge category={alert.category} />
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            {ALERT_TYPE_LABEL[alert.type]}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full ml-auto"
            style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)" }}
          >
            {ALERT_STATUS_LABEL[alert.status]}
          </span>
        </div>
        <h2 className="text-base font-semibold leading-snug mb-2" style={{ color: "var(--foreground)" }}>
          {alert.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          {alert.summary}
        </p>
      </div>

      {/* Plain summary */}
      <div
        className="rounded-lg p-4 mb-5"
        style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="text-xs font-semibold" style={{ color: "var(--accent-blue)" }}>简单来说</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          {alert.oneLiner && (
            <span className="block font-semibold mb-1">{alert.oneLiner}</span>
          )}
          {alert.plainSummary || generatePlainSummary(alert)}
        </p>
      </div>

      {/* Related assets */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {alert.relatedAssets.map((a) => (
          <span
            key={a}
            className="text-sm px-2 py-1 rounded font-mono font-medium"
            style={{ background: "var(--surface-overlay)", color: "var(--accent-blue)", border: "1px solid var(--border)" }}
          >
            {getCommodityName(a)}
          </span>
        ))}
        <span className="ml-auto text-sm" style={{ color: "var(--foreground-muted)" }}>
          置信度{" "}
          <strong style={{ color: "var(--foreground)" }}>{formatConfidence(alert.confidence)}</strong>
        </span>
      </div>

      {/* Spread info */}
      {si && (
        <Section title="价差快照">
          <div
            className="rounded-lg p-4 grid grid-cols-3 gap-4 mb-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>当前价差</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{ color: si.currentSpread < si.historicalMean ? "var(--negative)" : "var(--positive)" }}
              >
                {si.currentSpread > 0 ? "+" : ""}{si.currentSpread.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>{si.unit}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>历史均值</div>
              <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
                {si.historicalMean.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                ±1σ [{si.sigma1Lower.toFixed(2)}, {si.sigma1Upper.toFixed(2)}]
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>Z-Score</div>
              <div
                className="text-xl font-semibold font-mono"
                style={{ color: Math.abs(si.zScore) > 2 ? "var(--alert-critical)" : "var(--alert-high)" }}
              >
                {si.zScore > 0 ? "+" : ""}{si.zScore.toFixed(2)}σ
              </div>
              <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                {si.leg1} / {si.leg2}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>半衰期估算</div>
              <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>~{si.halfLife}天</div>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>ADF p-value</div>
              <div
                className="text-sm font-semibold"
                style={{ color: si.adfPValue < 0.05 ? "var(--positive)" : "var(--foreground-muted)" }}
              >
                {si.adfPValue.toFixed(3)}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Trigger chain */}
      <Section title="触发链路">
        <div className="relative pl-4">
          <div
            className="absolute left-1.5 top-2 bottom-2 w-px"
            style={{ background: "var(--border)" }}
          />
          {alert.triggerChain.map((step, i) => (
            <div key={step.step} className="relative flex gap-3 mb-4 last:mb-0">
              <div
                className="absolute -left-2.5 top-1 w-2 h-2 rounded-full border-2 shrink-0"
                style={{
                  background: i === alert.triggerChain.length - 1 ? "var(--accent-blue)" : "var(--surface-raised)",
                  borderColor: i === alert.triggerChain.length - 1 ? "var(--accent-blue)" : "var(--border)",
                }}
              />
              <div className="pl-2 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>
                    {step.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {formatRelativeTime(step.timestamp)}
                  </span>
                </div>
                <div className="text-sm" style={{ color: "var(--foreground)" }}>
                  {step.description}
                </div>
              </div>
            </div>
          ))}
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

      {/* Linkages */}
      {(alert.relatedStrategyId || alert.relatedRecommendationId) && (
        <Section title="关联信息">
          <div className="space-y-2">
            {alert.relatedStrategyId && (
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--foreground-muted)" }}>关联策略</span>
                <span className="font-mono text-xs" style={{ color: "var(--accent-blue)" }}>
                  {alert.relatedStrategyId}
                </span>
              </div>
            )}
            {alert.relatedRecommendationId && (
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--foreground-muted)" }}>关联推荐</span>
                <span className="font-mono text-xs" style={{ color: "var(--accent-blue)" }}>
                  {alert.relatedRecommendationId}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

    </div>
  );
}
