import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { StrategyPoolItem, SpreadHypothesis, ValidationMetrics } from '@/types/domain';

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('draft'), // 'draft' | 'active' | 'approaching_trigger' | 'paused' | 'watch_only' | 'retired'
  hypothesis: jsonb('hypothesis').$type<SpreadHypothesis>().notNull(),
  validation: jsonb('validation').$type<ValidationMetrics>().notNull(),
  relatedAlertIds: jsonb('related_alert_ids').$type<string[]>().notNull().default([]),
  recommendationHistory: jsonb('recommendation_history').$type<string[]>().notNull().default([]),
  executionFeedbackIds: jsonb('execution_feedback_ids').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivatedAt: timestamp('last_activated_at', { withTimezone: true }),
  notes: text('notes'),
}, (table) => ({
  statusIdx: index('strategies_status_idx').on(table.status),
  createdAtIdx: index('strategies_created_at_idx').on(table.createdAt),
}));

export type StrategyInsert = typeof strategies.$inferInsert;
export type StrategySelect = typeof strategies.$inferSelect;
