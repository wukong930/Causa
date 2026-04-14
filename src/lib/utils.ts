import type { AlertSeverity } from "@/types/domain";

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function severityOrder(severity: AlertSeverity): number {
  const map: Record<AlertSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return map[severity];
}

export function clsx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
