interface ProgressBarProps {
  value: number; // 0–1
  color?: string;
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({ value, color = "var(--accent-primary)", label, showPercent = true }: ProgressBarProps) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs w-16 shrink-0" style={{ color: "var(--foreground-muted)" }}>
          {label}
        </span>
      )}
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ background: "var(--surface-overlay)", height: "4px" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showPercent && (
        <span className="text-xs w-8 text-right shrink-0" style={{ color: "var(--foreground-muted)" }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
