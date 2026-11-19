import { resolveWhen, type Resolved } from "../reminders/resolve";
import { parseRepeat, type Repeat } from "../reminders/when";

/**
 * Words → the first run and the repeat ("every weekday at 8am" → next weekday 8:00, weekdays).
 * Without repeat words it is `keep` (when changing a routine's time) or a one-time job.
 */
export async function resolveSchedule(when: string, keep?: Repeat): Promise<{ ok: true; at: Date; repeat: Repeat } | Extract<Resolved, { ok: false }>> {
  const w = await resolveWhen(when);
  if (!w.ok) return w;
  return { ok: true, at: w.at, repeat: parseRepeat(when) ?? keep ?? "none" };
}
