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
  active: "活跃",
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
  active: "有效",
  expired: "已过期",
  superseded: "已替代",
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

// ─── Commodity name mapping ──────────────────────────────────────────────────

export const COMMODITY_NAME_MAP: Record<string, string> = {
  // 黑色
  RB: "螺纹钢", HC: "热卷", SS: "不锈钢", I: "铁矿石", J: "焦炭", JM: "焦煤", SF: "硅铁", SM: "锰硅",
  // 有色
  CU: "铜", AL: "铝", ZN: "锌", NI: "镍", SN: "锡", PB: "铅", AU: "黄金", AG: "白银", BC: "国际铜", PT: "铂", PD: "钯",
  // 能化
  SC: "原油", FU: "燃料油", LU: "低硫燃油", BU: "沥青", PP: "聚丙烯", TA: "PTA", MEG: "乙二醇", MA: "甲醇", EB: "苯乙烯", PG: "液化气", SA: "纯碱", UR: "尿素", V: "PVC", L: "塑料",
  // 农产品
  P: "棕榈油", Y: "豆油", M: "豆粕", OI: "菜油", RM: "菜粕", CF: "棉花", SR: "白糖", AP: "苹果", C: "玉米", CS: "淀粉", A: "豆一", B: "豆二", JD: "鸡蛋", LH: "生猪", SP: "纸浆", PK: "花生",
  // 外盘
  CL: "WTI原油", OIL: "布伦特原油", KC: "咖啡", RH: "铑",
};

/** Extract commodity prefix from contract symbol and return "中文名 CODE" */
export function getCommodityName(symbol: string): string {
  const match = symbol.match(/^([A-Z]+)/i);
  if (!match) return symbol;
  const prefix = match[1].toUpperCase();
  const name = COMMODITY_NAME_MAP[prefix];
  return name ? `${name} ${symbol}` : symbol;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { id: "dashboard",       label: "总览",     href: "/dashboard",       icon: "grid" },
  { id: "alerts",          label: "市场预警", href: "/alerts",          icon: "bell" },
  { id: "recommendations", label: "交易建议", href: "/recommendations", icon: "check-square" },
  { id: "strategies",      label: "监控策略", href: "/strategies",      icon: "layers" },
  { id: "positions",       label: "持仓跟踪", href: "/positions",       icon: "briefcase" },
  { id: "research",        label: "研究",     href: "/research",        icon: "file-text" },
  { id: "analytics",       label: "分析",     href: "/analytics",       icon: "bar-chart" },
  { id: "backtest",        label: "回测",     href: "/backtest",        icon: "activity" },
  { id: "settings",        label: "设置",     href: "/settings",        icon: "settings" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { id: "dashboard",       label: "首页",     href: "/dashboard",       icon: "home" },
  { id: "alerts",          label: "预警",     href: "/alerts",          icon: "bell" },
  { id: "recommendations", label: "建议",     href: "/recommendations", icon: "check-square" },
  { id: "strategies",      label: "策略",     href: "/strategies",      icon: "layers" },
  { id: "positions",       label: "持仓",     href: "/positions",       icon: "briefcase" },
] as const;
