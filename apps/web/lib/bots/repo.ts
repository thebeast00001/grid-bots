import { randomBytes } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import type { CritterConfig } from "../critter/types";
import { getDb } from "../db/client";
import { bots, memories, messages, type BotRow } from "../db/schema";
import { HttpStatus } from "../http";
import { mirrorBot, removeMirror } from "./mirror";

export type Bot = BotRow;
export type BotSummary = Bot & { preview: string | null };
export type BotPatch = Partial<Pick<Bot, "name" | "job" | "avatar" | "soul" | "interview" | "model" | "instructions">>;

export const BOT_ID = /^bot_[a-z0-9]{10}$/;

/** Lowercase ASCII letters/digits from the name (accents folded), max 16, then -2, -3… if taken. */
export function uniqueHandle(name: string, taken: string[]): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 16) || "bot";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function botMemories(botId: string) {
  const db = await getDb();
  return db.select().from(memories).where(eq(memories.botId, botId));
}

export async function createBot(input: { id?: string; name: string; job: string; avatar: CritterConfig }): Promise<Bot> {
  const name = input.name.trim();
  if (!name) throw new HttpStatus(400, "bad-name", "Give your bot a name.");
  if (input.id && !BOT_ID.test(input.id)) throw new HttpStatus(400, "bad-id", "Invalid bot id.");
  const db = await getDb();
  const taken = (await db.select({ handle: bots.handle }).from(bots)).map((r) => r.handle);
  const [bot] = await db
    .insert(bots)
    .values({
      id: input.id ?? `bot_${randomBytes(5).toString("hex")}`,
      name,
      handle: uniqueHandle(name, taken),
      job: input.job.trim(),
      avatar: input.avatar,
    })
    .returning();
  await mirrorBot(bot, []);
  return bot;
}

export async function getBot(id: string): Promise<Bot | null> {
  const db = await getDb();
  const [bot] = await db.select().from(bots).where(eq(bots.id, id));
  return bot ?? null;
}

/** All bots, most recently active first, each with a one-line preview of its last message. */
export async function listBots(): Promise<BotSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(bots).orderBy(desc(bots.updatedAt));
  const last = await db.execute<{ bot_id: string; role: string; parts: unknown }>(
    sql`select distinct on (bot_id) bot_id, role, parts from ${messages} order by bot_id, seq desc`,
  );
  const previews = new Map<string, string>();
  for (const r of last.rows) {
    const parts = (r.parts as { type: string; text?: string }[]) ?? [];
    const text = parts.find((p) => p.type === "text")?.text ?? (parts.some((p) => p.type === "file") ? "📎 Attachment" : "");
    if (text) previews.set(r.bot_id, `${r.role === "user" ? "You: " : ""}${text}`.slice(0, 120));
  }
  return rows.map((b) => ({ ...b, preview: previews.get(b.id) ?? null }));
}

export async function updateBot(id: string, patch: BotPatch): Promise<Bot> {
  const db = await getDb();
  const values: BotPatch & { updatedAt: string } = { ...patch, updatedAt: new Date().toISOString() };
  if (values.name !== undefined) {
    values.name = values.name.trim();
    if (!values.name) throw new HttpStatus(400, "bad-name", "Give your bot a name.");
  }
  const [bot] = await db.update(bots).set(values).where(eq(bots.id, id)).returning();
  if (!bot) throw new HttpStatus(404, "not-found", "Bot not found.");
  await mirrorBot(bot, await botMemories(id));
  return bot;
}

/** Marks a bot as just active (moves it to the top of the list). */
export async function touchBot(id: string): Promise<void> {
  const db = await getDb();
  await db.update(bots).set({ updatedAt: new Date().toISOString() }).where(eq(bots.id, id));
}

export async function deleteBot(id: string): Promise<void> {
  const db = await getDb();
  const [bot] = await db.delete(bots).where(eq(bots.id, id)).returning();
  if (bot) await removeMirror(bot.handle);
}
