import { randomBytes } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { getBot } from "../bots/repo";
import type { NotificationView } from "../client-types";
import { getDb } from "../db/client";
import { notifications, type NotificationRow } from "../db/schema";
import { openStreams, publish } from "../events";
import { sendPush } from "./push";
import { getSetting, userZone } from "../settings";
import { PING_FOR, shouldPing, type Importance, type NotificationKind, type PingFor, type QuietHours } from "./rules";

/** The inbox keeps this many; older ones are dropped. */
export const KEEP = 500;

export const toView = (n: NotificationRow): NotificationView => ({
  id: n.id,
  botId: n.botId,
  kind: n.kind,
  title: n.title,
  body: n.body,
  messageId: n.messageId,
  importance: n.importance,
  ping: n.ping,
  reason: n.reason ?? null,
  createdAt: n.createdAt.toISOString(),
  readAt: n.readAt?.toISOString() ?? null,
});

export async function notificationPrefs(): Promise<{ quietHours: QuietHours; pingFor: PingFor }> {
  const quietHours = (await getSetting<QuietHours>("quietHours")) ?? null;
  const p = await getSetting<PingFor>("pingFor");
  return { quietHours, pingFor: p && PING_FOR.includes(p) ? p : "skip-quiet" };
}

/**
 * Puts something a bot did on its own into the inbox, decides whether it pings you
 * (see rules.ts) and tells the open app. Returns what it recorded.
 */
export async function notify(input: { botId: string; kind: NotificationKind; body: string; messageId?: string; importance?: Importance; at?: Date }): Promise<NotificationView> {
  const bot = await getBot(input.botId);
  if (!bot) throw new Error(`No bot ${input.botId}`);
  const at = input.at ?? new Date();
  const importance = input.importance ?? "normal";
  const [{ quietHours, pingFor }, zone] = await Promise.all([notificationPrefs(), userZone()]);
  const decision = shouldPing({
    kind: input.kind,
    importance,
    mutedUntil: bot.mutedUntil ? new Date(bot.mutedUntil) : null,
    at,
    quietHours,
    pingFor,
    zone,
  });
  const db = await getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      id: `ntf_${randomBytes(6).toString("hex")}`,
      botId: input.botId,
      kind: input.kind,
      title: bot.name,
      body: input.body.slice(0, 500),
      messageId: input.messageId ?? null,
      importance,
      ping: decision.ping,
      reason: decision.ping ? null : decision.reason,
      createdAt: at,
    })
    .returning();
  await trim();
  const view = toView(row);
  publish({ type: "notification", notification: view });
  // With an app open, it shows the toast or system notification itself; otherwise push it.
  if (view.ping && openStreams() === 0) {
    await sendPush({ title: view.title, body: view.body, url: `/bots/${view.botId}`, tag: view.id }).catch((e) => console.error("[grid] push:", e));
  }
  return view;
}

async function trim(): Promise<void> {
  const db = await getDb();
  const extra = await db.select({ id: notifications.id }).from(notifications).orderBy(desc(notifications.createdAt), desc(notifications.id)).offset(KEEP);
  if (extra.length) await db.delete(notifications).where(inArray(notifications.id, extra.map((r) => r.id)));
}

/** Newest first. */
export async function listNotifications(limit = 100): Promise<NotificationView[]> {
  const db = await getDb();
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit);
  return rows.map(toView);
}

export async function unreadCounts(): Promise<{ total: number; byBot: Record<string, number> }> {
  const db = await getDb();
  const rows = await db.select({ botId: notifications.botId, n: count() }).from(notifications).where(isNull(notifications.readAt)).groupBy(notifications.botId);
  const byBot: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byBot[r.botId] = r.n;
    total += r.n;
  }
  return { total, byBot };
}

/** Marks a bot's, some, or all unread notifications read. Returns how many changed. */
export async function markRead(q: { botId?: string; ids?: string[]; all?: boolean }): Promise<number> {
  const where: SQL[] = [isNull(notifications.readAt)];
  if (q.botId) where.push(eq(notifications.botId, q.botId));
  else if (q.ids?.length) where.push(inArray(notifications.id, q.ids));
  else if (!q.all) return 0;
  const db = await getDb();
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...where))
    .returning({ id: notifications.id });
  return rows.length;
}
