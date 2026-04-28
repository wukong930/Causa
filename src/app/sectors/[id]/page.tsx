"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSectorAssessment } from "@/lib/api-client";
import { COMMODITY_NAME_MAP } from "@/lib/constants";
import type { SectorDetail, SymbolAssessmentSummary } from "@/lib/sector/hierarchy";

function DirectionDot({ direction }: { direction: number }) {
  const color =
    direction === 1 ? "var(--positive)" : direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)";
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />;
}

function MetricCell({ label, value, unit, highlight }: { label: string; value?: number | null; unit?: string; highlight?: boolean }) {
  if (value == null) return <td className="px-3 py-2 text-xs" style={{ color: "var(--foreground-muted)" }}>—</td>;
  const color = highlight && value < 0 ? "var(--alert-high)" : highlight && value > 0 ? "var(--positive)" : "var(--foreground)";
  return (
    <td className="px-3 py-2 text-xs font-mono" style={{ color }}>
      {typeof value === "number" ? (unit === "%" ? `${(value * 100).toFixed(1)}%` : value.toFixed(0)) : value}
      {unit && unit !== "%" && <span className="text-xs ml-0.5" style={{ color: "var(--foreground-muted)" }}>{unit}</span>}
    </td>
  );
}

/* ── PLACEHOLDER_DETAIL ── */

export default function SectorDetailPage() {
  const params = useParams();
  const sectorId = params.id as string;
  const [detail, setDetail] = useState<SectorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSectorAssessment(sectorId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [sectorId]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="h-48 rounded-lg animate-pulse" style={{ background: "var(--surface-raised)" }} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <p style={{ color: "var(--foreground-subtle)" }}>无法加载板块评估</p>
      </div>
    );
  }

  const dirColor =
    detail.direction === 1 ? "var(--positive)" : detail.direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/sectors"
          className="text-xs px-2 py-1 rounded"
          style={{ background: "var(--surface-raised)", color: "var(--foreground-subtle)" }}
        >
          板块总览
        </Link>
        <span style={{ color: "var(--foreground-muted)" }}>/</span>
        <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {detail.sectorName}板块
        </h1>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: "var(--accent-primary-muted)", color: "var(--accent-primary)" }}
        >
          L1
        </span>
      </div>

      {/* Summary card */}
      <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl font-bold" style={{ color: dirColor }}>
            {detail.directionLabel}
          </span>
          <span className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
            平均确信度 {detail.avgConviction}%
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>{detail.summary}</p>

        {detail.keyFactors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {detail.keyFactors.map((f, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: "var(--surface-raised)", color: "var(--foreground-subtle)" }}
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {detail.dataGaps.length > 0 && (
          <div className="mt-2 text-xs" style={{ color: "var(--alert-medium)" }}>
            数据缺口: {detail.dataGaps.join("; ")}
          </div>
        )}
      </div>

      {/* Symbol table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: "var(--surface-raised)" }}>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>品种</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>方向</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>确信度</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>成本线</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>利润</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>库存偏差</th>
              <th className="px-3 py-2 text-xs font-medium" style={{ color: "var(--foreground-subtle)" }}>主要因子</th>
            </tr>
          </thead>
          <tbody>
            {detail.symbols.map((s) => (
              <tr
                key={s.symbol}
                className="transition-colors"
                style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
              >
                <td className="px-3 py-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  <div className="flex items-center gap-1.5">
                    <DirectionDot direction={s.direction} />
                    {COMMODITY_NAME_MAP[s.symbol] ?? s.symbol}
                    <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{s.symbol}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs" style={{
                  color: s.direction === 1 ? "var(--positive)" : s.direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)"
                }}>
                  {s.directionLabel}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-raised)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.convictionPct}%`,
                          background: s.direction === 1 ? "var(--positive)" : s.direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{s.convictionPct}%</span>
                  </div>
                </td>
                <MetricCell label="成本" value={s.costFloor} unit="元" />
                <MetricCell label="利润" value={s.productionMargin} unit="元" highlight />
                <MetricCell label="库存偏差" value={s.inventoryDeviation} unit="%" highlight />
                <td className="px-3 py-2 text-xs max-w-[200px] truncate" style={{ color: "var(--foreground-subtle)" }}>
                  {s.topFactor ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
