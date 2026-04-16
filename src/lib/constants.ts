import type {
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AlertType,
  StrategyStatus,
  RecommendationStatus,
  RecommendedAction,
  SpreadModel,
  HypothesisType,
  Direction,
} from "@/types/domain";

// ─── Alert labels / colors ────────────────────────────────────────────────────

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

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  active: "待处理",
  acknowledged: "已确认",
  escalated: "已升级",
  expired: "已过期",
  archived: "已归档",
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  spread_anomaly: "价差异常",
  basis_shift: "基差偏移",
  momentum: "动量信号",
  event_driven: "事件驱动",
  inventory_shock: "库存冲击",
  regime_shift: "结构转变",
};

// ─── Strategy Pool labels / colors ───────────────────────────────────────────

export const STRATEGY_STATUS_LABEL: Record<StrategyStatus, string> = {
  draft: "草稿",
  active: "活跃",
  approaching_trigger: "接近触发",
  paused: "已暂停",
  watch_only: "仅观察",
  retired: "已退役",
};

export const STRATEGY_STATUS_COLOR: Record<StrategyStatus, string> = {
  draft: "text-[var(--foreground-subtle)]",
  active: "text-[var(--positive)]",
  approaching_trigger: "text-[var(--alert-high)]",
  paused: "text-[var(--foreground-muted)]",
  watch_only: "text-[var(--foreground-muted)]",
  retired: "text-[var(--foreground-subtle)]",
};

export const STRATEGY_STATUS_BG: Record<StrategyStatus, string> = {
  draft: "bg-[var(--surface-raised)]",
  active: "bg-[var(--positive-muted)]",
  approaching_trigger: "bg-[var(--alert-high-muted)]",
  paused: "bg-[var(--surface-raised)]",
  watch_only: "bg-[var(--surface-raised)]",
  retired: "bg-[var(--surface-raised)]",
};

export const SPREAD_MODEL_LABEL: Record<SpreadModel, string> = {
  calendar_spread: "跨期套利",
  cross_commodity: "跨品种套利",
  basis_trade: "基差交易",
  inter_market: "跨市场套利",
  triangular: "三角套利",
  event_driven: "事件驱动",
  structural: "结构化套利",
};

export const HYPOTHESIS_TYPE_LABEL: Record<HypothesisType, string> = {
  spread: "价差策略",
  directional: "方向性策略",
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  long: "做多",
  short: "做空",
};

// ─── Recommendation labels / colors ──────────────────────────────────────────

export const RECOMMENDATION_STATUS_LABEL: Record<RecommendationStatus, string> = {
  pending: "待处理",
  confirmed: "已确认",
  deferred: "已延后",
  ignored: "已忽略",
  backfilled: "已回填",
  expired: "已过期",
};

export const RECOMMENDED_ACTION_LABEL: Record<RecommendedAction, string> = {
  new_open: "新开仓",
  add: "加仓",
  reduce: "减仓",
  close: "平仓",
  hedge: "对冲",
  replace: "换仓",
  watchlist_only: "加入关注",
};

export const RECOMMENDED_ACTION_COLOR: Record<RecommendedAction, string> = {
  new_open: "text-[var(--positive)]",
  add: "text-[var(--positive)]",
  reduce: "text-[var(--alert-medium)]",
  close: "text-[var(--alert-high)]",
  hedge: "text-[var(--foreground-muted)]",
  replace: "text-[var(--alert-medium)]",
  watchlist_only: "text-[var(--foreground-muted)]",
};

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { id: "dashboard",       label: "总览",     href: "/dashboard",       icon: "grid" },
  { id: "alerts",          label: "预警",     href: "/alerts",          icon: "bell" },
  { id: "strategies",      label: "策略池",   href: "/strategies",      icon: "layers" },
  { id: "recommendations", label: "推荐与执行", href: "/recommendations", icon: "check-square" },
  { id: "positions",       label: "持仓",     href: "/positions",       icon: "briefcase" },
  { id: "research",        label: "研究",     href: "/research",        icon: "file-text" },
  { id: "settings",        label: "设置",     href: "/settings",        icon: "settings" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { id: "dashboard",       label: "首页",   href: "/dashboard",       icon: "home" },
  { id: "alerts",          label: "预警",   href: "/alerts",          icon: "bell" },
  { id: "strategies",      label: "策略池", href: "/strategies",      icon: "layers" },
  { id: "recommendations", label: "推荐",   href: "/recommendations", icon: "check-square" },
  { id: "positions",       label: "持仓",   href: "/positions",       icon: "briefcase" },
] as const;
