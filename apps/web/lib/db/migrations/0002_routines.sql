CREATE TABLE "routine_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"bot_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"message_id" text,
	"error" text,
	"late" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"name" text NOT NULL,
	"instruction" text NOT NULL,
	"anchor_at" timestamp with time zone NOT NULL,
	"next_run_at" timestamp with time zone,
	"repeat" text DEFAULT 'daily' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routine_runs" ADD CONSTRAINT "routine_runs_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_runs_routine_idx" ON "routine_runs" USING btree ("routine_id","started_at");--> statement-breakpoint
CREATE INDEX "routines_due_idx" ON "routines" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "routines_bot_idx" ON "routines" USING btree ("bot_id");