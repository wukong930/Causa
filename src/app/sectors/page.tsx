"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSectorOverview } from "@/lib/api-client";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { MarketOverview, SectorSnapshot } from "@/lib/sector/hierarchy";

function DirectionBadge({ direction, label, pct }: { direction: number; label: string; pct: number }) {
  const color =
    direction === 1 ? "var(--positive)" : direction === -1 ? "var(--alert-high)" : "var(--foreground-muted)";
  const bg =
    direction === 1 ? "var(--positive-muted)" : direction === -1 ? "var(--alert-high-muted)" : "var(--surface-raised)";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color, background: bg }}
    >
      {label} {pct}%
    </span>
  );
}

/* ── PLACEHOLDER_SECTOR_CARD ── */

function SectorCard({ sector }: { sector: SectorSnapshot }) {
  return (
    <Link href={`/sectors/${sector.sectorId}`}>
      <div
        className="rounded-lg p-4 transition-all hover:translate-y-[-1px]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {sector.sectorName}
          </h3>
          <DirectionBadge direction={sector.direction} label={sector.directionLabel} pct={sector.convictionPct} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs" style={{ color: "var(--foreground-subtle)" }}>
          <div>
            <div className="mb-0.5">品种数</div>
            <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{sector.symbolCount}</div>
          </div>
          <div>
            <div className="mb-0.5">活跃信号</div>
            <div
              className="text-sm font-medium"
              style={{ color: sector.activeSignals > 0 ? "var(--alert-high)" : "var(--foreground)" }}
            >
              {sector.activeSignals}
            </div>
          </div>
          <div>
            <div className="mb-0.5">最强品种</div>
            <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {sector.topSymbol ?? "—"}
              {sector.topSymbolConviction != null && (
                <span className="text-xs ml-1" style={{ color: "var(--foreground-subtle)" }}>
                  {sector.topSymbolConviction}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Conviction bar */}
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-raised)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, sector.convictionPct)}%`,
              background:
                sector.direction === 1
                  ? "var(--positive)"
                  : sector.direction === -1
                    ? "var(--alert-high)"
                    : "var(--foreground-muted)",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

/* ── PLACEHOLDER_PAGE ── */

export default function SectorsPage() {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSectorOverview()
      .then(setOverview)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg animate-pulse" style={{ background: "var(--surface-raised)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6">
        <p style={{ color: "var(--foreground-subtle)" }}>无法加载板块数据</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* L0 Summary */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            市场全景
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "var(--accent-primary-muted)", color: "var(--accent-primary)" }}
          >
            L0
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--foreground-subtle)" }}>
          {overview.summary}
        </p>
        <div className="mt-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
          共 {overview.totalSignals} 个活跃信号
        </div>
      </div>

      {/* Sector Cards */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          板块评估
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {overview.sectors.map((sector) => (
            <SectorCard key={sector.sectorId} sector={sector} />
          ))}
        </div>
      </div>
    </div>
  );
}
