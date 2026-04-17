import { pgTable, uuid, text, timestamp, real, varchar, index } from 'drizzle-orm/pg-core';

/**
 * Signal tracking table — records every signal emitted by trigger evaluators.
 * Used to compute historical hit rates per signal type for ensemble weighting.
 */
export const signalTrack = pgTable('signal_track', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id'),
  signalType: varchar('signal_type', { length: 30 }).notNull(), // spread_anomaly, regime_shift, etc.
  category: varchar('category', { length: 20 }).notNull(),
  confidence: real('confidence').notNull(),
  zScore: real('z_score'),
  regime: varchar('regime', { length: 20 }),
  outcome: varchar('outcome', { length: 20 }).notNull().default('pending'), // hit, miss, pending
  positionId: uuid('position_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => [
  index('signal_track_type_idx').on(table.signalType),
  index('signal_track_category_idx').on(table.category),
  index('signal_track_outcome_idx').on(table.outcome),
  index('signal_track_alert_idx').on(table.alertId),
]);
