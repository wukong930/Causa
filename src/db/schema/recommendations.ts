import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { Recommendation, RecommendationLeg } from '@/types/domain';
import { strategies } from './strategies';
import { alerts } from './alerts';

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  alertId: uuid('alert_id').references(() => alerts.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'confirmed' | 'deferred' | 'ignored' | 'backfilled' | 'expired'
  recommendedAction: varchar('recommended_action', { length: 20 }).notNull(), // 'new_open' | 'add' | 'reduce' | 'close' | 'hedge' | 'replace' | 'watchlist_only'
  legs: jsonb('legs').$type<RecommendationLeg[]>().notNull(),
  priorityScore: real('priority_score').notNull(),
  portfolioFitScore: real('portfolio_fit_score').notNull(),
  marginEfficiencyScore: real('margin_efficiency_score').notNull(),
  marginRequired: real('margin_required').notNull(),
  reasoning: text('reasoning').notNull(),
  oneLiner: text('one_liner'),
  riskItems: jsonb('risk_items').$type<string[]>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deferredUntil: timestamp('deferred_until', { withTimezone: true }),
  ignoredReason: text('ignored_reason'),
  executionFeedbackId: uuid('execution_feedback_id'),
}, (table) => ({
  statusIdx: index('recommendations_status_idx').on(table.status),
  strategyIdIdx: index('recommendations_strategy_id_idx').on(table.strategyId),
  alertIdIdx: index('recommendations_alert_id_idx').on(table.alertId),
  createdAtIdx: index('recommendations_created_at_idx').on(table.createdAt),
}));

export type RecommendationInsert = typeof recommendations.$inferInsert;
export type RecommendationSelect = typeof recommendations.$inferSelect;
