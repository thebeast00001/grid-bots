import { bigserial, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { CritterConfig } from "../critter/types";
import type { ModelRef } from "../models/types";

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

export type Memory = typeof memories.$inferSelect;
export type BotRow = typeof bots.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type ProviderRow = typeof providers.$inferSelect;
export type FileRow = typeof files.$inferSelect;
