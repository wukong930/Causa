import { pgTable, text, timestamp, real, varchar, index } from 'drizzle-orm/pg-core';
import type { MarketDataPoint } from '@/types/domain';

export const marketData = pgTable('market_data', {
  id: text('id').primaryKey(), // composite: {symbol}_{timestamp}
  market: varchar('market', { length: 10 }).notNull(),
  exchange: varchar('exchange', { length: 10 }).notNull(),
  commodity: text('commodity').notNull(),
  symbol: text('symbol').notNull(),
  contractMonth: text('contract_month').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  settle: real('settle').notNull(),
  volume: real('volume').notNull(),
  openInterest: real('open_interest').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  timezone: text('timezone').notNull(),
}, (table) => ({
  symbolIdx: index('market_data_symbol_idx').on(table.symbol),
  timestampIdx: index('market_data_timestamp_idx').on(table.timestamp),
  symbolTimestampIdx: index('market_data_symbol_timestamp_idx').on(table.symbol, table.timestamp),
}));

export type MarketDataInsert = typeof marketData.$inferInsert;
export type MarketDataSelect = typeof marketData.$inferSelect;
