import { pgTable, text, timestamp, real, varchar, index } from 'drizzle-orm/pg-core';

export const industryData = pgTable('industry_data', {
  id: text('id').primaryKey(), // composite: {symbol}_{dataType}_{date}
  symbol: text('symbol').notNull(),
  dataType: varchar('data_type', { length: 20 }).notNull(), // inventory | spot_price | basis
  value: real('value').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
}, (table) => ({
  symbolIdx: index('industry_data_symbol_idx').on(table.symbol),
  typeIdx: index('industry_data_type_idx').on(table.dataType),
  symbolTypeIdx: index('industry_data_symbol_type_idx').on(table.symbol, table.dataType),
}));

export type IndustryDataInsert = typeof industryData.$inferInsert;
export type IndustryDataSelect = typeof industryData.$inferSelect;
