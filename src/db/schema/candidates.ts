import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import type { CandidateRequestStatus } from '@/types/domain';

export const candidateRequests = pgTable('candidate_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id'),
  strategyId: uuid('strategy_id'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  generatedRecommendationId: uuid('generated_recommendation_id'),
  failureReason: jsonb('failure_reason'),
}, (table) => ({
  alertIdIdx: index('candidate_requests_alert_id_idx').on(table.alertId),
  strategyIdIdx: index('candidate_requests_strategy_id_idx').on(table.strategyId),
  statusIdx: index('candidate_requests_status_idx').on(table.status),
}));

export type CandidateRequestInsert = typeof candidateRequests.$inferInsert;
export type CandidateRequestSelect = typeof candidateRequests.$inferSelect;
