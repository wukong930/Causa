import { pgTable, uuid, text, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';
import { recommendations } from './recommendations';
import { strategies } from './strategies';

export const executionFeedback = pgTable('execution_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id, { onDelete: 'set null' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  legs: jsonb('legs').notNull(),
  totalMarginUsed: real('total_margin_used').notNull(),
  totalCommission: real('total_commission').notNull(),
  slippageNote: text('slippage_note'),
  liquidityNote: text('liquidity_note'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recommendationIdIdx: index('execution_feedback_recommendation_id_idx').on(table.recommendationId),
  strategyIdIdx: index('execution_feedback_strategy_id_idx').on(table.strategyId),
  createdAtIdx: index('execution_feedback_created_at_idx').on(table.createdAt),
}));

export type ExecutionFeedbackInsert = typeof executionFeedback.$inferInsert;
export type ExecutionFeedbackSelect = typeof executionFeedback.$inferSelect;
