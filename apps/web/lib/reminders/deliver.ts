import { randomBytes } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { getBot, touchBot } from "../bots/repo";
import { getDb } from "../db/client";
import { messages, reminders } from "../db/schema";
import { publish } from "../events";
import { notify } from "../notifications/repo";
import { userZone } from "../settings";
import { nextOccurrence } from "./when";

/** Later than this after its time, a reminder is shown as late (Grid wasn't running). */
const LATE_MS = 2 * 60_000;

export type ReminderPart = { type: "data-reminder"; data: { reminderId: string; text: string; dueAt: string; late: boolean } };

/**
 * Sends every reminder that is due by `now` into its bot's chat. Each one is claimed
 * with a single UPDATE, so overlapping calls never send it twice. A repeating
 * reminder moves on to its next time after now: one that missed several while Grid
 * was off is sent once.
 */
export async function deliverDue(now: Date): Promise<number> {
  const db = await getDb();
  const claimed = await db
    .update(reminders)
    .set({ status: "fired", firedAt: now })
    .where(and(eq(reminders.status, "scheduled"), lte(reminders.dueAt, now)))
    .returning();
  if (claimed.length === 0) return 0;

  const zone = await userZone();
  for (const r of claimed) {
    try {
      const bot = await getBot(r.botId);
      if (!bot) continue;
      const late = now.getTime() - r.dueAt.getTime() > LATE_MS;
      const id = `msg_${randomBytes(8).toString("hex")}`;
      const part: ReminderPart = { type: "data-reminder", data: { reminderId: r.id, text: r.text, dueAt: r.dueAt.toISOString(), late } };
      await db.insert(messages).values({
        id,
        botId: r.botId,
        role: "assistant",
        parts: [{ type: "text", text: `⏰ ${r.text}` }, part],
        metadata: { reminderId: r.id },
      });
      const next = nextOccurrence(r.anchorAt, r.repeat, now, zone);
      await db
        .update(reminders)
        .set(next ? { status: "scheduled", dueAt: next, late: false } : { late })
        .where(eq(reminders.id, r.id));
      await touchBot(r.botId);
      publish({ type: "message", botId: r.botId, messageId: id, title: bot.name, body: r.text });
      await notify({ botId: r.botId, kind: "reminder", body: r.text, messageId: id });
      publish({ type: "reminders", botId: r.botId });
    } catch (e) {
      console.error(`[grid] couldn't deliver reminder ${r.id}:`, e);
    }
  }
  return claimed.length;
}
