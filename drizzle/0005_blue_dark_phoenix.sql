CREATE TABLE "industry_data" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"data_type" varchar(20) NOT NULL,
	"value" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"source" varchar(50) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "max_holding_days" integer;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "position_size_pct" real;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "risk_reward_ratio" real;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "backtest_summary" jsonb;--> statement-breakpoint
CREATE INDEX "industry_data_symbol_idx" ON "industry_data" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "industry_data_type_idx" ON "industry_data" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "industry_data_symbol_type_idx" ON "industry_data" USING btree ("symbol","data_type");