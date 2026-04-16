import { pgTable, uuid, text, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const contextSnapshots = pgTable('context_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  macroRegime: text('macro_regime').notNull(),
  liquidity: text('liquidity').notNull(),
  usd: text('usd').notNull(),
  commodityClusters: jsonb('commodity_clusters').$type<Record<string, string>>().notNull(),
  keyEvents: jsonb('key_events').$type<string[]>().notNull(),
  regimeConfidence: real('regime_confidence').notNull(),
  macroData: jsonb('macro_data'),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  snapshotAtIdx: index('context_snapshots_snapshot_at_idx').on(table.snapshotAt),
}));

export type ContextSnapshotInsert = typeof contextSnapshots.$inferInsert;
export type ContextSnapshotSelect = typeof contextSnapshots.$inferSelect;
