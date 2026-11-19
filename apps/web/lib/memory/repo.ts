import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { mirrorBot, mirrorUser } from "../bots/mirror";
import { getBot } from "../bots/repo";
import { getDb } from "../db/client";
import { memories, type Memory } from "../db/schema";
import { HttpStatus } from "../http";

const scope = (botId: string | null) => (botId === null ? isNull(memories.botId) : eq(memories.botId, botId));

/** Rewrites USER.md or the bot's MEMORY.md after a change. */
async function remirror(botId: string | null) {
  if (botId === null) return mirrorUser(await listMemories(null));
  const bot = await getBot(botId);
  if (bot) await mirrorBot(bot, await listMemories(botId));
}

export async function listMemories(botId: string | null): Promise<Memory[]> {
  const db = await getDb();
  return db.select().from(memories).where(scope(botId)).orderBy(desc(memories.pinned), desc(memories.createdAt));
}

export async function searchMemories(botId: string | null, q: string): Promise<Memory[]> {
  const db = await getDb();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select()
    .from(memories)
    .where(and(scope(botId), ilike(memories.text, pattern)))
    .orderBy(desc(memories.pinned), desc(memories.createdAt));
}

export async function addMemory(input: { botId: string | null; text: string; source: "you" | "bot"; sourceMessageId?: string; pinned?: boolean }): Promise<Memory> {
  const text = input.text.trim().slice(0, 1000);
  if (!text) throw new HttpStatus(400, "empty", "A memory needs some text.");
  const db = await getDb();
  const [m] = await db
    .insert(memories)
    .values({
      id: `mem_${randomBytes(6).toString("hex")}`,
      botId: input.botId,
      text,
      source: input.source,
      sourceMessageId: input.sourceMessageId ?? null,
      pinned: input.pinned ?? false,
    })
    .returning();
  await remirror(input.botId);
  return m;
}

export async function updateMemory(id: string, patch: { text?: string; pinned?: boolean }): Promise<Memory> {
  const db = await getDb();
  const values: { text?: string; pinned?: boolean } = { ...patch };
  if (values.text !== undefined) {
    values.text = values.text.trim().slice(0, 1000);
    if (!values.text) throw new HttpStatus(400, "empty", "A memory needs some text.");
  }
  const [m] = await db.update(memories).set(values).where(eq(memories.id, id)).returning();
  if (!m) throw new HttpStatus(404, "not-found", "Memory not found.");
  await remirror(m.botId);
  return m;
}

export async function deleteMemory(id: string): Promise<Memory | null> {
  const db = await getDb();
  const [m] = await db.delete(memories).where(eq(memories.id, id)).returning();
  if (m) await remirror(m.botId);
  return m ?? null;
}
