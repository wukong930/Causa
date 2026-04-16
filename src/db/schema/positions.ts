import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { PositionGroup, PositionLeg } from '@/types/domain';
import { strategies } from './strategies';
import { recommendations } from './recommendations';

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  strategyName: text('strategy_name'),
  recommendationId: uuid('recommendation_id').references(() => recommendations.id, { onDelete: 'set null' }),
  legs: jsonb('legs').$type<PositionLeg[]>().notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
  entrySpread: real('entry_spread').notNull(),
  currentSpread: real('current_spread').notNull(),
  spreadUnit: text('spread_unit').notNull(),
  unrealizedPnl: real('unrealized_pnl').notNull(),
  totalMarginUsed: real('total_margin_used').notNull(),
  exitCondition: text('exit_condition').notNull(),
  targetZScore: real('target_z_score').notNull(),
  currentZScore: real('current_z_score').notNull(),
  halfLifeDays: real('half_life_days').notNull(),
  daysHeld: real('days_held').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open' | 'closed' | 'partially_closed'
  closedAt: timestamp('closed_at', { withTimezone: true }),
  realizedPnl: real('realized_pnl'),
}, (table) => ({
  statusIdx: index('positions_status_idx').on(table.status),
  strategyIdIdx: index('positions_strategy_id_idx').on(table.strategyId),
  openedAtIdx: index('positions_opened_at_idx').on(table.openedAt),
}));

export type PositionInsert = typeof positions.$inferInsert;
export type PositionSelect = typeof positions.$inferSelect;
