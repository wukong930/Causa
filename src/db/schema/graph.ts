import { pgTable, uuid, text, real, varchar, integer, jsonb, index } from 'drizzle-orm/pg-core';
import type { CommodityNode, RelationshipEdge, CommodityCluster, NodeStatus, RelationshipType } from '@/types/domain';

export const commodityNodes = pgTable('commodity_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull().unique(),
  cluster: varchar('cluster', { length: 20 }).notNull(),
  exchange: text('exchange').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('unknown'),
  activeAlertCount: integer('active_alert_count').notNull().default(0),
  regime: text('regime').notNull(),
  priceChange24h: real('price_change_24h'),
}, (table) => ({
  clusterIdx: index('commodity_nodes_cluster_idx').on(table.cluster),
  symbolIdx: index('commodity_nodes_symbol_idx').on(table.symbol),
}));

export const relationshipEdges = pgTable('relationship_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: uuid('source').notNull().references(() => commodityNodes.id, { onDelete: 'cascade' }),
  target: uuid('target').notNull().references(() => commodityNodes.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  strength: real('strength').notNull(),
  label: text('label'),
  activeAlertCount: integer('active_alert_count').notNull().default(0),
}, (table) => ({
  sourceIdx: index('relationship_edges_source_idx').on(table.source),
  targetIdx: index('relationship_edges_target_idx').on(table.target),
}));

export type CommodityNodeInsert = typeof commodityNodes.$inferInsert;
export type CommodityNodeSelect = typeof commodityNodes.$inferSelect;
export type RelationshipEdgeInsert = typeof relationshipEdges.$inferInsert;
export type RelationshipEdgeSelect = typeof relationshipEdges.$inferSelect;
