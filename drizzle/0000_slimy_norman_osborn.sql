CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"severity" varchar(20) NOT NULL,
	"category" varchar(20) NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"triggered_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"confidence" real NOT NULL,
	"related_assets" jsonb NOT NULL,
	"spread_info" jsonb,
	"trigger_chain" jsonb NOT NULL,
	"risk_items" jsonb NOT NULL,
	"manual_check_items" jsonb NOT NULL,
	"related_strategy_id" uuid,
	"related_recommendation_id" uuid,
	"related_research_id" uuid,
	"invalidation_reason" text
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"hypothesis" jsonb NOT NULL,
	"validation" jsonb NOT NULL,
	"related_alert_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"execution_feedback_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activated_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" uuid,
	"alert_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"recommended_action" varchar(20) NOT NULL,
	"legs" jsonb NOT NULL,
	"priority_score" real NOT NULL,
	"portfolio_fit_score" real NOT NULL,
	"margin_efficiency_score" real NOT NULL,
	"margin_required" real NOT NULL,
	"reasoning" text NOT NULL,
	"risk_items" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deferred_until" timestamp with time zone,
	"ignored_reason" text,
	"execution_feedback_id" uuid
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" uuid,
	"strategy_name" text,
	"recommendation_id" uuid,
	"legs" jsonb NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"entry_spread" real NOT NULL,
	"current_spread" real NOT NULL,
	"spread_unit" text NOT NULL,
	"unrealized_pnl" real NOT NULL,
	"total_margin_used" real NOT NULL,
	"exit_condition" text NOT NULL,
	"target_z_score" real NOT NULL,
	"current_z_score" real NOT NULL,
	"half_life_days" real NOT NULL,
	"days_held" real NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"realized_pnl" real
);
--> statement-breakpoint
CREATE TABLE "execution_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid,
	"strategy_id" uuid,
	"legs" jsonb NOT NULL,
	"total_margin_used" real NOT NULL,
	"total_commission" real NOT NULL,
	"slippage_note" text,
	"liquidity_note" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_hypotheses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_strategy_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_alert_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setup_id" text NOT NULL,
	"alert_id" uuid,
	"expression" text NOT NULL,
	"leg1_asset" text NOT NULL,
	"leg1_contract" text NOT NULL,
	"leg1_direction" varchar(10) NOT NULL,
	"leg1_target_size" real,
	"leg1_unit" text,
	"leg2_asset" text,
	"leg2_contract" text,
	"leg2_direction" varchar(10),
	"leg2_target_size" real,
	"leg2_unit" text,
	"confidence" real DEFAULT 0 NOT NULL,
	"liquidity_score" real DEFAULT 0 NOT NULL,
	"execution_window" text NOT NULL,
	"key_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmation_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodity_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"cluster" varchar(20) NOT NULL,
	"exchange" text NOT NULL,
	"status" varchar(20) DEFAULT 'unknown' NOT NULL,
	"active_alert_count" integer DEFAULT 0 NOT NULL,
	"regime" text NOT NULL,
	"price_change_24h" real,
	CONSTRAINT "commodity_nodes_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "relationship_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" uuid NOT NULL,
	"target" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"strength" real NOT NULL,
	"label" text,
	"active_alert_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_data" (
	"id" text PRIMARY KEY NOT NULL,
	"market" varchar(10) NOT NULL,
	"exchange" varchar(10) NOT NULL,
	"commodity" text NOT NULL,
	"symbol" text NOT NULL,
	"contract_month" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"open" real NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"close" real NOT NULL,
	"settle" real NOT NULL,
	"volume" real NOT NULL,
	"open_interest" real NOT NULL,
	"currency" varchar(3) NOT NULL,
	"timezone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"net_value" real NOT NULL,
	"available_margin" real NOT NULL,
	"margin_utilization_rate" real NOT NULL,
	"total_unrealized_pnl" real NOT NULL,
	"today_realized_pnl" real NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid,
	"strategy_id" uuid,
	"requested_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"generated_recommendation_id" uuid,
	"failure_reason" jsonb
);
--> statement-breakpoint
CREATE TABLE "execution_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"legs" jsonb NOT NULL,
	"total_margin_used" real NOT NULL,
	"total_commission" real NOT NULL,
	"slippage_note" jsonb,
	"liquidity_note" jsonb,
	"notes" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_category_idx" ON "alerts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_triggered_at_idx" ON "alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "strategies_status_idx" ON "strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "strategies_created_at_idx" ON "strategies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "recommendations_status_idx" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recommendations_strategy_id_idx" ON "recommendations" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "recommendations_alert_id_idx" ON "recommendations" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "recommendations_created_at_idx" ON "recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "positions_strategy_id_idx" ON "positions" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "positions_opened_at_idx" ON "positions" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "execution_feedback_recommendation_id_idx" ON "execution_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "execution_feedback_strategy_id_idx" ON "execution_feedback" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "execution_feedback_created_at_idx" ON "execution_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "research_hypotheses_status_idx" ON "research_hypotheses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "research_hypotheses_created_at_idx" ON "research_hypotheses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "research_reports_type_idx" ON "research_reports" USING btree ("type");--> statement-breakpoint
CREATE INDEX "research_reports_published_at_idx" ON "research_reports" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "suggestions_status_idx" ON "suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suggestions_setup_id_idx" ON "suggestions" USING btree ("setup_id");--> statement-breakpoint
CREATE INDEX "commodity_nodes_cluster_idx" ON "commodity_nodes" USING btree ("cluster");--> statement-breakpoint
CREATE INDEX "commodity_nodes_symbol_idx" ON "commodity_nodes" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "relationship_edges_source_idx" ON "relationship_edges" USING btree ("source");--> statement-breakpoint
CREATE INDEX "relationship_edges_target_idx" ON "relationship_edges" USING btree ("target");--> statement-breakpoint
CREATE INDEX "market_data_symbol_idx" ON "market_data" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "market_data_timestamp_idx" ON "market_data" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "market_data_symbol_timestamp_idx" ON "market_data" USING btree ("symbol","timestamp");--> statement-breakpoint
CREATE INDEX "account_snapshots_snapshot_at_idx" ON "account_snapshots" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "candidate_requests_alert_id_idx" ON "candidate_requests" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "candidate_requests_strategy_id_idx" ON "candidate_requests" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "candidate_requests_status_idx" ON "candidate_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "execution_drafts_recommendation_id_idx" ON "execution_drafts" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "execution_drafts_status_idx" ON "execution_drafts" USING btree ("status");