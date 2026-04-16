import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const llmConfig = pgTable('llm_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 20 }).notNull(), // 'openai' | 'anthropic' | 'deepseek'
  apiKey: text('api_key').notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  baseUrl: text('base_url'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LLMConfigInsert = typeof llmConfig.$inferInsert;
export type LLMConfigSelect = typeof llmConfig.$inferSelect;
