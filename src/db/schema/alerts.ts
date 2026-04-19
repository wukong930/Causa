import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { Alert, SpreadInfo, TriggerStep } from '@/types/domain';
import { strategies } from './strategies';
import { researchReports } from './research';

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  confidence: real('confidence').notNull(),
  relatedAssets: jsonb('related_assets').$type<string[]>().notNull(),
  spreadInfo: jsonb('spread_info').$type<SpreadInfo>(),
  triggerChain: jsonb('trigger_chain').$type<TriggerStep[]>().notNull(),
  riskItems: jsonb('risk_items').$type<string[]>().notNull(),
  manualCheckItems: jsonb('manual_check_items').$type<string[]>().notNull(),
  oneLiner: text('one_liner'),
  relatedStrategyId: uuid('related_strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  relatedRecommendationId: uuid('related_recommendation_id'),
  relatedResearchId: uuid('related_research_id').references(() => researchReports.id, { onDelete: 'set null' }),
  invalidationReason: text('invalidation_reason'),
}, (table) => ({
  statusIdx: index('alerts_status_idx').on(table.status),
  categoryIdx: index('alerts_category_idx').on(table.category),
  severityIdx: index('alerts_severity_idx').on(table.severity),
  triggeredAtIdx: index('alerts_triggered_at_idx').on(table.triggeredAt),
}));

export type AlertInsert = typeof alerts.$inferInsert;
export type AlertSelect = typeof alerts.$inferSelect;
