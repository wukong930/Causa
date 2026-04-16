"use client";

import { useState, useMemo } from "react";
import { formatNumber } from "@/lib/utils";

type TimeWindow = "1W" | "1M" | "3M";

function generateData(baseValue: number, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const dayOffset = (i - days / 2) * (baseValue * 0.003) + Math.sin(i * 0.8) * (baseValue * 0.006);
    return { date: date.toISOString().slice(0, 10), value: Math.round(baseValue + dayOffset) };
  });
}

const WINDOW_DAYS: Record<TimeWindow, number> = { "1W": 7, "1M": 30, "3M": 90 };

export function NetValueChart({ baseValue }: { baseValue: number }) {
  const [window, setWindow] = useState<TimeWindow>("1M");

  const data = useMemo(() => generateData(baseValue, WINDOW_DAYS[window]), [baseValue, window]);

  const W = 560, H = 100, PAD = 4;
  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.998;
  const max = Math.max(...values) * 1.002;
  const range = max - min || 1;

  function x(i: number) { return PAD + (i / (values.length - 1)) * (W - PAD * 2); }
  function y(v: number) { return H - PAD - ((v - min) / range) * (H - PAD * 2); }

  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaPath = `M${x(0)},${H - PAD} ${values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(values.length - 1)},${H - PAD} Z`;

  const current = values[values.length - 1];
  const prev = values[values.length - 2];
  const change = current - prev;
  const changePct = prev !== 0 ? ((change / prev) * 100).toFixed(2) : "0.00";
  const isUp = change >= 0;

  // Pick ~3 label indices spread across the data
  const labelIndices = [0, Math.floor(values.length / 2), values.length - 1];

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--foreground-subtle)" }}>账户净值</div>
          <div className="text-xl font-semibold font-mono" style={{ color: "var(--foreground)" }}>
            ¥{formatNumber(current)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(["1W", "1M", "3M"] as TimeWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className="text-xs px-2 py-0.5 rounded transition-colors"
              style={{
                background: window === w ? "var(--accent-blue)" : "var(--surface-overlay)",
                color: window === w ? "#fff" : "var(--foreground-muted)",
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-sm font-semibold font-mono"
          style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}
        >
          {isUp ? "+" : ""}¥{formatNumber(change)} ({isUp ? "+" : ""}{changePct}%)
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="netValueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        <path d={areaPath} fill="url(#netValueGrad)" />
        <polyline points={pts} fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill="var(--accent-blue)" />
        {labelIndices.map((i) => (
          <text key={i} x={x(i)} y={H - 1} textAnchor="middle" fontSize="9" fill="var(--foreground-subtle)">
            {data[i].date.slice(5)}
          </text>
        ))}
      </svg>

      <div className="flex justify-between text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
        <span>¥{formatNumber(min)}</span>
        <span>¥{formatNumber(max)}</span>
      </div>
    </div>
  );
}
