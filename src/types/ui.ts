import type { AlertSeverity, SetupStatus, AlertCategory } from "./domain";

// ─── Navigation ─────────────────────────────────────────────────────────────

export type NavSection =
  | "dashboard"
  | "alerts"
  | "setups"
  | "research"
  | "map"
  | "suggestions"
  | "settings";

export interface NavItem {
  id: NavSection;
  label: string;
  labelEn: string;
  href: string;
  icon: string; // icon name
  badgeCount?: number;
}

// ─── Filter States ───────────────────────────────────────────────────────────

export interface AlertFilters {
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  status?: string[];
  search?: string;
}

export interface SetupFilters {
  status?: SetupStatus[];
  family?: string[];
  category?: AlertCategory[];
  minConfidence?: number;
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
