import type { AlertSeverity, AlertCategory } from "@/types/domain";
import { SEVERITY_LABEL, CATEGORY_LABEL } from "@/lib/constants";
import { clsx } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: AlertSeverity;
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "sm" }: SeverityBadgeProps) {
  const colorMap: Record<AlertSeverity, { bg: string; text: string; dot: string }> = {
    critical: {
      bg: "var(--alert-critical-muted)",
      text: "var(--alert-critical)",
      dot: "var(--alert-critical)",
    },
    high: {
      bg: "var(--alert-high-muted)",
      text: "var(--alert-high)",
      dot: "var(--alert-high)",
    },
    medium: {
      bg: "var(--alert-medium-muted)",
      text: "var(--alert-medium)",
      dot: "var(--alert-medium)",
    },
    low: {
      bg: "var(--alert-low-muted)",
      text: "var(--alert-low)",
      dot: "var(--alert-low)",
    },
  };

  const c = colorMap[severity];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded font-semibold",
        size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1"
      )}
      style={{ background: c.bg, color: c.text }}
    >
      <span
        className={clsx("rounded-full shrink-0", size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5")}
        style={{ background: c.dot }}
      />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

interface CategoryBadgeProps {
  category: AlertCategory;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
