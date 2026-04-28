import { pgTable, text, timestamp, real, integer, jsonb, varchar, index } from 'drizzle-orm/pg-core';

export const sectorAssessments = pgTable('sector_assessments', {
  id: text('id').primaryKey(), // composite: {sector}_{symbol}_{date}
  sector: varchar('sector', { length: 20 }).notNull(),
  symbol: text('symbol').notNull(),
  convictionScore: real('conviction_score').notNull(),
  convictionDirection: integer('conviction_direction').notNull(), // +1/0/-1
  supportingFactors: jsonb('supporting_factors').$type<unknown[]>().default([]),
  opposingFactors: jsonb('opposing_factors').$type<unknown[]>().default([]),
  dataGaps: jsonb('data_gaps').$type<string[]>().default([]),
  costFloor: real('cost_floor'),
  productionMargin: real('production_margin'),
  inventoryDeviation: real('inventory_deviation'),
  seasonalFactor: real('seasonal_factor'),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
}, (table) => ({
  sectorIdx: index('sector_assessments_sector_idx').on(table.sector),
  symbolIdx: index('sector_assessments_symbol_idx').on(table.symbol),
  sectorSymbolIdx: index('sector_assessments_sector_symbol_idx').on(table.sector, table.symbol),
}));

export type SectorAssessmentInsert = typeof sectorAssessments.$inferInsert;
export type SectorAssessmentSelect = typeof sectorAssessments.$inferSelect;
