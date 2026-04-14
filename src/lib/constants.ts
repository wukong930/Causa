import type { AlertSeverity, AlertCategory, SetupStatus } from "@/types/domain";

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "极高",
  high: "高",
  medium: "中",
  low: "低",
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: "text-[var(--alert-critical)]",
  high: "text-[var(--alert-high)]",
  medium: "text-[var(--alert-medium)]",
  low: "text-[var(--alert-low)]",
};

export const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: "bg-[var(--alert-critical-muted)]",
  high: "bg-[var(--alert-high-muted)]",
  medium: "bg-[var(--alert-medium-muted)]",
  low: "bg-[var(--alert-low-muted)]",
};

export const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  critical: "border-[var(--alert-critical)]",
  high: "border-[var(--alert-high)]",
  medium: "border-[var(--alert-medium)]",
  low: "border-[var(--alert-low)]",
};

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  ferrous: "黑色",
  nonferrous: "有色",
  energy: "能化",
  agriculture: "农产品",
  overseas: "海外",
};

export const SETUP_STATUS_LABEL: Record<SetupStatus, string> = {
  watching: "观察中",
  approaching_trigger: "接近触发",
  triggered: "已触发",
  invalid: "已失效",
  completed: "已完成",
};

export const SETUP_STATUS_COLOR: Record<SetupStatus, string> = {
  watching: "text-[var(--foreground-muted)]",
  approaching_trigger: "text-[var(--alert-high)]",
  triggered: "text-[var(--alert-critical)]",
  invalid: "text-[var(--foreground-subtle)]",
  completed: "text-[var(--positive)]",
};

export const NAV_ITEMS = [
  { id: "dashboard", label: "总览", href: "/dashboard", icon: "grid" },
  { id: "alerts", label: "预警", href: "/alerts", icon: "bell" },
  { id: "setups", label: "策略池", href: "/setups", icon: "layers" },
  { id: "research", label: "研究", href: "/research", icon: "file-text" },
  { id: "map", label: "市场图谱", href: "/map", icon: "share-2" },
  { id: "suggestions", label: "建议与执行", href: "/suggestions", icon: "check-square" },
  { id: "settings", label: "设置", href: "/settings", icon: "settings" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { id: "dashboard", label: "首页", href: "/dashboard", icon: "home" },
  { id: "alerts", label: "预警", href: "/alerts", icon: "bell" },
  { id: "setups", label: "策略池", href: "/setups", icon: "layers" },
  { id: "watchlist", label: "关注", href: "/watchlist", icon: "star" },
  { id: "settings", label: "设置", href: "/settings", icon: "settings" },
] as const;
