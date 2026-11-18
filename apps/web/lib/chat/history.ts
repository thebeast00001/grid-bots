import type { UIMessage } from "ai";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { touchBot } from "../bots/repo";
import { getDb } from "../db/client";
import { messages } from "../db/schema";
import { HttpStatus } from "../http";

/** Hidden opener the client sends to start a new bot's interview (Task 10). Never stored. */
export const START = "[[start]]";

type Meta = Record<string, unknown>;

export const textOf = (m: Pick<UIMessage, "parts">) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

export async function loadThread(botId: string): Promise<UIMessage[]> {
  const db = await getDb();
  const rows = await db.select().from(messages).where(eq(messages.botId, botId)).orderBy(asc(messages.seq));
  return rows.map((r) => ({ id: r.id, role: r.role, parts: r.parts as UIMessage["parts"], metadata: r.metadata }));
}

/**
 * Stores the user's message and returns the thread to answer:
 * - submit with a new id → append;
 * - submit with an existing id (an edit) → replace it and drop everything after it;
 * - regenerate → drop the last assistant reply.
 */
export async function applyIncoming(botId: string, msg: UIMessage, trigger: "submit-message" | "regenerate-message"): Promise<UIMessage[]> {
  const db = await getDb();
  const readAt = new Date().toISOString();

  if (trigger === "regenerate-message") {
    const [last] = await db.select().from(messages).where(eq(messages.botId, botId)).orderBy(desc(messages.seq)).limit(1);
    if (last?.role === "assistant") await db.delete(messages).where(eq(messages.id, last.id));
  } else {
    const [existing] = await db.select().from(messages).where(eq(messages.id, msg.id));
    if (existing && (existing.botId !== botId || existing.role !== "user")) {
      throw new HttpStatus(409, "id-in-use", "That message id is already used.");
    }
    if (existing) {
      await db
        .update(messages)
        .set({ parts: msg.parts, metadata: { ...(existing.metadata as Meta), readAt } })
        .where(eq(messages.id, msg.id));
      await db.delete(messages).where(and(eq(messages.botId, botId), gt(messages.seq, existing.seq)));
    } else {
      const meta = (msg.metadata ?? {}) as Meta;
      await db.insert(messages).values({ id: msg.id, botId, role: "user", parts: msg.parts, metadata: { ...meta, readAt } });
    }
  }
  await touchBot(botId);
  return loadThread(botId);
}

export async function saveAssistant(botId: string, msg: UIMessage): Promise<void> {
  if (msg.parts.length === 0) return;
  const db = await getDb();
  await db
    .insert(messages)
    .values({ id: msg.id, botId, role: "assistant", parts: msg.parts, metadata: (msg.metadata ?? {}) as Meta })
    .onConflictDoUpdate({ target: messages.id, set: { parts: msg.parts } });
  await touchBot(botId);
}

/** Merges fields into a message's metadata (reactions). */
export async function patchMessageMeta(id: string, patch: Meta): Promise<Meta | null> {
  const db = await getDb();
  const [row] = await db.select().from(messages).where(eq(messages.id, id));
  if (!row) return null;
  const metadata = { ...(row.metadata as Meta), ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === null) delete metadata[k];
  await db.update(messages).set({ metadata }).where(eq(messages.id, id));
  return metadata;
}

const size = (m: UIMessage) => m.parts.reduce((n, p) => n + (p.type === "text" ? p.text.length : 200), 0);

/** The newest messages whose text fits in `budget` characters (always keeps the last one). */
export function trimHistory(msgs: UIMessage[], budget = 60_000): UIMessage[] {
  const out: UIMessage[] = [];
  let used = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    used += size(msgs[i]);
    if (used > budget && out.length > 0) break;
    out.unshift(msgs[i]);
  }
  return out;
}
