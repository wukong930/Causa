import type { AlertSeverity, AlertCategory, StrategyStatus, AlertStatus, RecommendationStatus } from "./domain";

// ─── Navigation ─────────────────────────────────────────────────────────────

export type NavSection =
  | "dashboard"
  | "alerts"
  | "strategies"
  | "recommendations"
  | "positions"
  | "research"
  | "settings";

export interface NavItem {
  id: NavSection;
  label: string;
  href: string;
  icon: string;
  badgeCount?: number;
}

// ─── Filter States ───────────────────────────────────────────────────────────

export interface AlertFilters {
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  status?: AlertStatus[];
  search?: string;
}

export interface StrategyFilters {
  status?: StrategyStatus[];
  spreadModel?: string[];
  category?: AlertCategory[];
  search?: string;
}

export interface RecommendationFilters {
  status?: RecommendationStatus[];
  action?: string[];
  search?: string;
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  id: string;
  label: string;
  value: number; // change percent or z-score
  alertCount: number;
  cluster: string;
}

// ─── Time window ─────────────────────────────────────────────────────────────

export type TimeWindow = "1h" | "4h" | "1d" | "3d" | "1w";

// ─── Drawer / Panel state ────────────────────────────────────────────────────

export interface DrawerState<T = string> {
  open: boolean;
  selectedId: T | null;
}
