import { pgTable, uuid, varchar, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import type { ExecutionDraftStatus } from '@/types/domain';
import { recommendations } from './recommendations';

export const executionDrafts = pgTable('execution_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').notNull().references(() => recommendations.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  legs: jsonb('legs').notNull(),
  totalMarginUsed: real('total_margin_used').notNull(),
  totalCommission: real('total_commission').notNull(),
  slippageNote: jsonb('slippage_note'),
  liquidityNote: jsonb('liquidity_note'),
  notes: jsonb('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recommendationIdIdx: index('execution_drafts_recommendation_id_idx').on(table.recommendationId),
  statusIdx: index('execution_drafts_status_idx').on(table.status),
}));

export type ExecutionDraftInsert = typeof executionDrafts.$inferInsert;
export type ExecutionDraftSelect = typeof executionDrafts.$inferSelect;
