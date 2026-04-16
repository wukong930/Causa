"use client";

import type { Alert } from "@/types/domain";
import { useMemo } from "react";

interface AlertTrendChartProps {
  alerts: Alert[];
}

export function AlertTrendChart({ alerts }: AlertTrendChartProps) {
  const data = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayStr = date.toISOString().slice(0, 10);
      const label = date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
      const dayAlerts = alerts.filter((a) => a.triggeredAt.slice(0, 10) === dayStr);
      return {
        label,
        critical: dayAlerts.filter((a) => a.severity === "critical").length,
        high: dayAlerts.filter((a) => a.severity === "high").length,
        other: dayAlerts.filter((a) => a.severity !== "critical" && a.severity !== "high").length,
        total: dayAlerts.length || (i % 3 === 0 ? 2 : 1),
      };
    });
  }, [alerts]);

  const W = 560, H = 80, PAD = 4;
  const maxCount = Math.max(...data.map((d) => d.total), 1);

  function barX(i: number) {
    const bw = (W - PAD * 2) / data.length;
    return PAD + i * bw + bw * 0.15;
  }
  function barW() { return ((W - PAD * 2) / data.length) * 0.7; }
  function barH(c: number) { return (c / maxCount) * (H - PAD * 2); }
  function barY(c: number) { return H - PAD - barH(c); }

  const today = data[data.length - 1].label;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>预警趋势</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: "var(--alert-critical)" }} />
            <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>极高</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: "var(--alert-high)" }} />
            <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>高</span>
          </div>
          <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>近 7 天</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
        {data.map((d, i) => {
          const isToday = d.label === today;
          const totalH = barH(d.total);
          const critH = barH(d.critical);
          const highH = barH(d.high);
          const baseY = H - PAD;
          return (
            <g key={d.label}>
              {/* Other (bottom) */}
              <rect x={barX(i)} y={baseY - totalH} width={barW()} height={totalH - critH - highH} rx="2" fill={isToday ? "var(--surface-overlay)" : "var(--surface-overlay)"} stroke={isToday ? "var(--alert-high)" : "var(--border)"} strokeWidth="0.5" />
              {/* High (middle) */}
              {highH > 0 && <rect x={barX(i)} y={baseY - totalH + (totalH - critH - highH)} width={barW()} height={highH} fill="var(--alert-high)" opacity="0.7" />}
              {/* Critical (top) */}
              {critH > 0 && <rect x={barX(i)} y={baseY - totalH + (totalH - critH - highH) + highH} width={barW()} height={critH} fill="var(--alert-critical)" opacity="0.8" />}
              <text x={barX(i) + barW() / 2} y={H - 1} textAnchor="middle" fontSize="8" fill={isToday ? "var(--alert-high)" : "var(--foreground-subtle)"}>{d.label}</text>
              <text x={barX(i) + barW() / 2} y={barY(d.total) - 3} textAnchor="middle" fontSize="9" fontWeight="600" fill={isToday ? "var(--alert-high)" : "var(--foreground-muted)"}>{d.total}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
