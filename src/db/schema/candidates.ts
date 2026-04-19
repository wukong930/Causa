import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { alerts } from './alerts';
import { strategies } from './strategies';
import { recommendations } from './recommendations';

export const candidateRequests = pgTable('candidate_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id').references(() => alerts.id, { onDelete: 'set null' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  generatedRecommendationId: uuid('generated_recommendation_id').references(() => recommendations.id, { onDelete: 'set null' }),
  failureReason: jsonb('failure_reason'),
}, (table) => ({
  alertIdIdx: index('candidate_requests_alert_id_idx').on(table.alertId),
  strategyIdIdx: index('candidate_requests_strategy_id_idx').on(table.strategyId),
  statusIdx: index('candidate_requests_status_idx').on(table.status),
}));

export type CandidateRequestInsert = typeof candidateRequests.$inferInsert;
export type CandidateRequestSelect = typeof candidateRequests.$inferSelect;
