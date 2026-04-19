CREATE TABLE "signal_track" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid,
	"signal_type" varchar(30) NOT NULL,
	"category" varchar(20) NOT NULL,
	"confidence" real NOT NULL,
	"z_score" real,
	"regime" varchar(20),
	"outcome" varchar(20) DEFAULT 'pending' NOT NULL,
	"position_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "one_liner" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "one_liner" text;--> statement-breakpoint
CREATE INDEX "signal_track_type_idx" ON "signal_track" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "signal_track_category_idx" ON "signal_track" USING btree ("category");--> statement-breakpoint
CREATE INDEX "signal_track_outcome_idx" ON "signal_track" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "signal_track_alert_idx" ON "signal_track" USING btree ("alert_id");