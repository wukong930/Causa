import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { Suggestion, SuggestionStatus } from '@/types/domain';

export const suggestions = pgTable('suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  setupId: text('setup_id').notNull(),
  alertId: uuid('alert_id'),
  expression: text('expression').notNull(),
  leg1Asset: text('leg1_asset').notNull(),
  leg1Contract: text('leg1_contract').notNull(),
  leg1Direction: varchar('leg1_direction', { length: 10 }).notNull(),
  leg1TargetSize: real('leg1_target_size'),
  leg1Unit: text('leg1_unit'),
  leg2Asset: text('leg2_asset'),
  leg2Contract: text('leg2_contract'),
  leg2Direction: varchar('leg2_direction', { length: 10 }),
  leg2TargetSize: real('leg2_target_size'),
  leg2Unit: text('leg2_unit'),
  confidence: real('confidence').notNull().default(0),
  liquidityScore: real('liquidity_score').notNull().default(0),
  executionWindow: text('execution_window').notNull(),
  keyRisks: jsonb('key_risks').$type<string[]>().notNull().default([]),
  confirmationChecklist: jsonb('confirmation_checklist').$type<string[]>().notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('suggestions_status_idx').on(table.status),
  setupIdIdx: index('suggestions_setup_id_idx').on(table.setupId),
}));

export type SuggestionInsert = typeof suggestions.$inferInsert;
export type SuggestionSelect = typeof suggestions.$inferSelect;
