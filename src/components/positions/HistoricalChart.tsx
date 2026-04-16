import type { DailyPnL, DrawdownPoint } from "@/lib/analytics";
import { formatNumber } from "@/lib/utils";

interface HistoricalChartProps {
  cumulativePnL: DailyPnL[];
  drawdownSeries: DrawdownPoint[];
}

// ─── Cumulative P&L Line Chart ────────────────────────────────────────────────

function CumulativePnLChart({ data }: { data: DailyPnL[] }) {
  if (data.length < 2) {
    return (
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          数据不足，无法绘制收益曲线
        </p>
      </div>
    );
  }

  const width = 600;
  const height = 160;
  const padding = { top: 12, right: 16, bottom: 24, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minVal = Math.min(...data.map((d) => d.cumulative));
  const maxVal = Math.max(...data.map((d) => d.cumulative));
  const range = maxVal - minVal || 1;

  const scaleX = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const scaleY = (v: number) =>
    padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

  // Build path
  const points = data.map((d, i) => `${scaleX(i)},${scaleY(d.cumulative)}`);
  const linePath = `M ${points.join(" L ")}`;

  // Zero line
  const zeroY = scaleY(0);
  const zeroLine =
    zeroY >= padding.top && zeroY <= height - padding.bottom
      ? `M ${padding.left},${zeroY} L ${width - padding.right},${zeroY}`
      : null;

  // Positive area (fill under the line above zero)
  const areaPath =
    linePath +
    ` L ${width - padding.right},${height - padding.bottom} L ${padding.left},${height - padding.bottom} Z`;

  // Last value
  const last = data[data.length - 1];
  const lastColor = last.cumulative >= 0 ? "var(--positive)" : "var(--negative)";

  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>
        累计收益曲线
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + chartHeight * (1 - t);
          const val = minVal + range * t;
          return (
            <g key={t}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--foreground-subtle)"
              >
                {formatNumber(val)}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        {zeroLine && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="var(--foreground-muted)"
            strokeWidth="0.5"
            strokeDasharray="4,2"
          />
        )}

        {/* Area fill */}
        <defs>
          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--negative)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--negative)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={lastColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* End dot */}
        <circle
          cx={scaleX(data.length - 1)}
          cy={scaleY(last.cumulative)}
          r="3"
          fill={lastColor}
        />

        {/* Label */}
        <text
          x={scaleX(data.length - 1) - 6}
          y={scaleY(last.cumulative) - 6}
          textAnchor="end"
          fontSize="9"
          fill={lastColor}
          fontWeight="600"
        >
          {last.cumulative >= 0 ? "+" : ""}
          {formatNumber(last.cumulative)}
        </text>

        {/* X axis labels */}
        {data.length > 0 && (
          <>
            <text
              x={padding.left}
              y={height - 4}
              textAnchor="start"
              fontSize="8"
              fill="var(--foreground-subtle)"
            >
              {data[0].date.slice(5)}
            </text>
            <text
              x={width - padding.right}
              y={height - 4}
              textAnchor="end"
              fontSize="8"
              fill="var(--foreground-subtle)"
            >
              {data[data.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Drawdown Area Chart ──────────────────────────────────────────────────────

function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="text-center py-4">
        <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
          数据不足，无法绘制回撤图
        </p>
      </div>
    );
  }

  const width = 600;
  const height = 100;
  const padding = { top: 8, right: 16, bottom: 20, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxDrawdown = Math.max(...data.map((d) => d.drawdown), 0.01);

  const scaleX = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const scaleY = (v: number) =>
    padding.top + chartHeight - (v / maxDrawdown) * chartHeight;

  const areaPoints = data.map((d, i) => `${scaleX(i)},${scaleY(d.drawdown)}`);
  const areaPath =
    `M ${padding.left},${padding.top + chartHeight} ` +
    areaPoints.map((p) => `L ${p}`).join(" ") +
    ` L ${width - padding.right},${padding.top + chartHeight} Z`;

  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>
        回撤曲线
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {[0, 0.5, 1].map((t) => {
          const y = padding.top + chartHeight * (1 - t);
          return (
            <g key={t}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--foreground-subtle)"
              >
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path
          d={areaPath}
          fill="var(--negative)"
          fillOpacity="0.15"
        />

        {/* Line */}
        <polyline
          points={areaPoints.join(" ")}
          fill="none"
          stroke="var(--negative)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Max drawdown label */}
        {data.length > 0 && (
          <text
            x={scaleX(data.length - 1) - 6}
            y={scaleY(data[data.length - 1].drawdown) - 4}
            textAnchor="end"
            fontSize="8"
            fill="var(--negative)"
          >
            {(data[data.length - 1].drawdown * 100).toFixed(1)}%
          </text>
        )}

        {/* X axis */}
        <text
          x={padding.left}
          y={height - 4}
          textAnchor="start"
          fontSize="8"
          fill="var(--foreground-subtle)"
        >
          {data[0].date.slice(5)}
        </text>
        <text
          x={width - padding.right}
          y={height - 4}
          textAnchor="end"
          fontSize="8"
          fill="var(--foreground-subtle)"
        >
          {data[data.length - 1].date.slice(5)}
        </text>
      </svg>
    </div>
  );
}

// ─── Win Rate Gauge ──────────────────────────────────────────────────────────

function WinRateGauge({ winRate }: { winRate: number }) {
  const pct = Math.round(winRate * 100);
  const color =
    pct >= 55 ? "var(--positive)" : pct >= 40 ? "var(--alert-medium)" : "var(--negative)";

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-subtle)" }}>
        胜率
      </div>
      <div className="relative w-20 h-20">
        {/* Background circle */}
        <svg viewBox="0 0 36 36" className="w-full h-full">
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="var(--surface-overlay)"
            strokeWidth="3"
          />
          {/* Progress arc */}
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${pct}, 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HistoricalChart({ cumulativePnL, drawdownSeries }: HistoricalChartProps) {
  const hasData = cumulativePnL.length >= 2;

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {!hasData ? (
        <div className="text-center py-8">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--foreground-subtle)", margin: "0 auto" }}
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <p className="text-sm mt-3" style={{ color: "var(--foreground-muted)" }}>
            历史数据不足
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
            平仓更多策略后即可查看收益分析与回撤统计
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <CumulativePnLChart data={cumulativePnL} />
            </div>
            <div className="flex items-center justify-center px-4">
              <WinRateGauge
                winRate={
                  cumulativePnL.length > 0
                    ? cumulativePnL.filter((d) => d.realized > 0).length /
                      Math.max(cumulativePnL.length, 1)
                    : 0
                }
              />
            </div>
          </div>
          <DrawdownChart data={drawdownSeries} />
        </div>
      )}
    </div>
  );
}
