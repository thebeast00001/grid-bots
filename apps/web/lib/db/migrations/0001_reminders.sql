CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"text" text NOT NULL,
	"anchor_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"fired_at" timestamp with time zone,
	"late" boolean DEFAULT false NOT NULL,
	"source_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "reminders_bot_idx" ON "reminders" USING btree ("bot_id");