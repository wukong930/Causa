import { pgTable, uuid, real, timestamp, index } from 'drizzle-orm/pg-core';

export const accountSnapshots = pgTable('account_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  netValue: real('net_value').notNull(),
  availableMargin: real('available_margin').notNull(),
  marginUtilizationRate: real('margin_utilization_rate').notNull(),
  totalUnrealizedPnl: real('total_unrealized_pnl').notNull(),
  todayRealizedPnl: real('today_realized_pnl').notNull(),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
}, (table) => ({
  snapshotAtIdx: index('account_snapshots_snapshot_at_idx').on(table.snapshotAt),
}));

export type AccountSnapshotInsert = typeof accountSnapshots.$inferInsert;
export type AccountSnapshotSelect = typeof accountSnapshots.$inferSelect;
