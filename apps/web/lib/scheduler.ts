import { subscribe } from "./events";
import { deliverDue } from "./reminders/deliver";
import { nextDueAt } from "./reminders/repo";

/**
 * Wakes up when the next reminder is due (at least every 30 s, so a clock change or a
 * missed event can't strand one), delivers what's due, and sleeps again. Any change to
 * reminders re-arms the timer. One per server process.
 */

const MAX_SLEEP_MS = 30_000;

type State = { timer?: ReturnType<typeof setTimeout>; off: () => void; busy: boolean };
const g = globalThis as unknown as { __gridScheduler?: State };

async function arm(): Promise<void> {
  const s = g.__gridScheduler;
  if (!s) return;
  let wait = MAX_SLEEP_MS;
  try {
    const next = await nextDueAt();
    if (next) wait = Math.min(MAX_SLEEP_MS, Math.max(0, next.getTime() - Date.now()));
  } catch {
    // The database isn't ready yet; try again on the next wake-up.
  }
  if (g.__gridScheduler !== s) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => void tick(), wait + 25);
}

async function tick(): Promise<void> {
  const s = g.__gridScheduler;
  if (!s) return;
  if (!s.busy) {
    s.busy = true;
    try {
      await deliverDue(new Date());
    } catch (e) {
      console.error("[grid] reminders:", e);
    } finally {
      s.busy = false;
    }
  }
  await arm();
}

export function startScheduler(): void {
  if (g.__gridScheduler) return;
  g.__gridScheduler = { busy: false, off: subscribe((e) => e.type === "reminders" && void arm()) };
  void tick();
}

export function stopScheduler(): void {
  const s = g.__gridScheduler;
  if (!s) return;
  clearTimeout(s.timer);
  s.off();
  g.__gridScheduler = undefined;
}
