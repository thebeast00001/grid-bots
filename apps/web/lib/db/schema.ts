import { sql } from "drizzle-orm";
import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CritterConfig } from "../critter/types";
import type { ModelRef } from "../models/types";
import type { Repeat } from "../reminders/when";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull();

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
});

export const providers = pgTable("providers", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  baseUrl: text("base_url"),
  /** Sealed JSON (see lib/vault.ts). */
  secret: text("secret"),
  createdAt: createdAt(),
});

export const bots = pgTable("bots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull().unique(),
  job: text("job").notNull().default(""),
  avatar: jsonb("avatar").$type<CritterConfig>().notNull(),
  soul: text("soul").notNull().default(""),
  interview: text("interview").$type<"pending" | "done" | "skipped">().notNull().default("pending"),
  model: jsonb("model").$type<ModelRef | null>(),
  instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  seq: bigserial("seq", { mode: "number" }).notNull(),
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  parts: jsonb("parts").$type<unknown[]>().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  /** null = a memory about the user, shared by every bot. */
  botId: text("bot_id").references(() => bots.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  source: text("source").$type<"you" | "bot">().notNull(),
  sourceMessageId: text("source_message_id"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: createdAt(),
});

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mediaType: text("media_type").notNull(),
  size: integer("size").notNull(),
  createdAt: createdAt(),
});

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** The first time asked for; repeats are counted from it so month-ends don't drift. */
    anchorAt: instant("anchor_at").notNull(),
    dueAt: instant("due_at").notNull(),
    repeat: text("repeat").$type<Repeat>().notNull().default("none"),
    status: text("status").$type<"scheduled" | "fired" | "done" | "cancelled">().notNull().default("scheduled"),
    firedAt: instant("fired_at"),
    /** Delivered more than two minutes after it was due (Grid wasn't running). */
    late: boolean("late").notNull().default(false),
    sourceMessageId: text("source_message_id"),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_due_idx").on(t.status, t.dueAt), index("reminders_bot_idx").on(t.botId)],
);

export const routines = pgTable(
  "routines",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instruction: text("instruction").notNull(),
    /** The first time asked for; later times count from it (see nextOccurrence). */
    anchorAt: instant("anchor_at").notNull(),
    /** Null once a one-time routine has run. */
    nextRunAt: instant("next_run_at"),
    repeat: text("repeat").$type<Repeat>().notNull().default("daily"),
    status: text("status").$type<"active" | "paused" | "done">().notNull().default("active"),
    lastRunAt: instant("last_run_at"),
    createdAt: createdAt(),
  },
  (t) => [index("routines_due_idx").on(t.status, t.nextRunAt), index("routines_bot_idx").on(t.botId)],
);

export const routineRuns = pgTable(
  "routine_runs",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    botId: text("bot_id").notNull(),
    trigger: text("trigger").$type<"schedule" | "manual">().notNull(),
    status: text("status").$type<"running" | "done" | "failed" | "missed">().notNull(),
    startedAt: instant("started_at").notNull(),
    finishedAt: instant("finished_at"),
    messageId: text("message_id"),
    error: text("error"),
    late: boolean("late").notNull().default(false),
  },
  (t) => [
    index("routine_runs_routine_idx").on(t.routineId, t.startedAt),
    // One run per routine at a time: a second start fails here instead of racing.
    uniqueIndex("routine_runs_one_running").on(t.routineId).where(sql`${t.status} = 'running'`),
  ],
);

export type Memory = typeof memories.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type RunRow = typeof routineRuns.$inferSelect;
export type ReminderRow = typeof reminders.$inferSelect;
export type BotRow = typeof bots.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ProviderRow = typeof providers.$inferSelect;
export type FileRow = typeof files.$inferSelect;
