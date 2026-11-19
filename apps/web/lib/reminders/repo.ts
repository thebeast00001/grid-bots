import { randomBytes } from "node:crypto";
import { and, asc, count, eq, min, type SQL } from "drizzle-orm";
import type { ReminderView } from "../client-types";
import { getDb } from "../db/client";
import { messages, reminders, type ReminderRow } from "../db/schema";
import { publish } from "../events";
import { HttpStatus } from "../http";
import type { Repeat } from "./when";

export const MAX_UPCOMING = 200;
export const MAX_TEXT = 500;

export const toView = (r: ReminderRow): ReminderView => ({
  id: r.id,
  botId: r.botId,
  text: r.text,
  dueAt: r.dueAt.toISOString(),
  repeat: r.repeat,
  status: r.status,
  late: r.late,
  firedAt: r.firedAt?.toISOString() ?? null,
});

function cleanText(text: string): string {
  const t = text.trim();
  if (!t || t.length > MAX_TEXT) throw new HttpStatus(400, "bad-text", `A reminder needs 1–${MAX_TEXT} characters.`);
  return t;
}

/** Applies a change and tells the open app; null when the reminder doesn't exist. */
async function change(id: string, set: Partial<ReminderRow>): Promise<ReminderView | null> {
  const db = await getDb();
  const [row] = await db.update(reminders).set(set).where(eq(reminders.id, id)).returning();
  if (!row) return null;
  publish({ type: "reminders", botId: row.botId });
  return toView(row);
}

export async function createReminder(input: { botId: string; text: string; at: Date; repeat: Repeat; sourceMessageId?: string }): Promise<ReminderView> {
  const text = cleanText(input.text);
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(reminders)
    .where(and(eq(reminders.botId, input.botId), eq(reminders.status, "scheduled")));
  if (n >= MAX_UPCOMING) throw new HttpStatus(409, "too-many", `This bot already has ${MAX_UPCOMING} upcoming reminders. Cancel some first.`);
  const [row] = await db
    .insert(reminders)
    .values({
      id: `rem_${randomBytes(6).toString("hex")}`,
      botId: input.botId,
      text,
      anchorAt: input.at,
      dueAt: input.at,
      repeat: input.repeat,
      sourceMessageId: input.sourceMessageId ?? null,
    })
    .returning();
  publish({ type: "reminders", botId: row.botId });
  return toView(row);
}

/** A bot's reminders (or everyone's); `upcoming` keeps only scheduled ones. Soonest first. */
export async function listReminders(q: { botId?: string; upcoming?: boolean } = {}): Promise<ReminderView[]> {
  const db = await getDb();
  const where: SQL[] = [];
  if (q.botId) where.push(eq(reminders.botId, q.botId));
  if (q.upcoming) where.push(eq(reminders.status, "scheduled"));
  const rows = await db
    .select()
    .from(reminders)
    .where(and(...where))
    .orderBy(asc(reminders.dueAt));
  return rows.map(toView);
}

export async function getReminder(id: string): Promise<ReminderView | null> {
  const db = await getDb();
  const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
  return row ? toView(row) : null;
}

/** A new time restarts it (and its repeats) from that time. */
export async function updateReminder(id: string, p: { text?: string; at?: Date; repeat?: Repeat }): Promise<ReminderView | null> {
  const set: Partial<ReminderRow> = {};
  if (p.text !== undefined) set.text = cleanText(p.text);
  if (p.repeat !== undefined) set.repeat = p.repeat;
  if (p.at) Object.assign(set, { anchorAt: p.at, dueAt: p.at, status: "scheduled", late: false });
  return change(id, set);
}

export async function snoozeReminder(id: string, until: Date): Promise<ReminderView | null> {
  return change(id, { dueAt: until, status: "scheduled", late: false });
}

/** Done with it: a one-off is finished; a repeating one just carries on to its next time. */
export async function completeReminder(id: string): Promise<ReminderView | null> {
  const current = await getReminder(id);
  if (!current || current.repeat !== "none") return current;
  return change(id, { status: "done" });
}

export async function cancelReminder(id: string): Promise<ReminderView | null> {
  return change(id, { status: "cancelled" });
}

export type Occurrence = { state: "done"; at: string } | { state: "snoozed"; until: string };

/** Notes on a delivered reminder's message what was done with it, so its card shows that after a reload. */
export async function recordOccurrence(messageId: string, reminderId: string, occurrence: Occurrence): Promise<void> {
  const db = await getDb();
  const [m] = await db.select({ metadata: messages.metadata }).from(messages).where(eq(messages.id, messageId));
  if (!m || m.metadata.reminderId !== reminderId) return;
  await db
    .update(messages)
    .set({ metadata: { ...m.metadata, reminder: occurrence } })
    .where(eq(messages.id, messageId));
}

/** When the next scheduled reminder is due, for the scheduler's timer. */
export async function nextDueAt(): Promise<Date | null> {
  const db = await getDb();
  const [{ at }] = await db.select({ at: min(reminders.dueAt) }).from(reminders).where(eq(reminders.status, "scheduled"));
  return at ?? null;
}
