import { pgTable, uuid, text, timestamp, real, jsonb, varchar, index } from 'drizzle-orm/pg-core';
import type { ResearchReport, ReportType, Hypothesis } from '@/types/domain';

export const hypotheses = pgTable('research_hypotheses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  confidence: real('confidence').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('research_hypotheses_status_idx').on(table.status),
  createdAtIdx: index('research_hypotheses_created_at_idx').on(table.createdAt),
}));

export const researchReports = pgTable('research_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 20 }).notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  hypotheses: jsonb('hypotheses').$type<Hypothesis[]>().notNull().default([]),
  relatedStrategyIds: jsonb('related_strategy_ids').$type<string[]>().notNull().default([]),
  relatedAlertIds: jsonb('related_alert_ids').$type<string[]>().notNull().default([]),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('research_reports_type_idx').on(table.type),
  publishedAtIdx: index('research_reports_published_at_idx').on(table.publishedAt),
}));

export type ResearchReportInsert = typeof researchReports.$inferInsert;
export type ResearchReportSelect = typeof researchReports.$inferSelect;
export type HypothesisInsert = typeof hypotheses.$inferInsert;
export type HypothesisSelect = typeof hypotheses.$inferSelect;
