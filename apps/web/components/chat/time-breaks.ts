import { DateTime } from "luxon";

/** A quiet gap this long starts a new stretch of the conversation, with its time over it. */
const GAP_MS = 15 * 60_000;

type Timed = { id: string; metadata?: unknown };
const atOf = (m: Timed) => {
  const at = (m.metadata as { at?: string } | undefined)?.at;
  const t = at ? Date.parse(at) : NaN;
  return Number.isNaN(t) ? null : t;
};

function label(t: number, o: { now: Date; locale?: string; zone?: string }): string {
  const d = DateTime.fromMillis(t, { zone: o.zone }).setLocale(o.locale ?? "en-US");
  const now = DateTime.fromJSDate(o.now, { zone: o.zone });
  // Newer ICU puts a narrow no-break space before AM/PM; a plain one reads the same everywhere.
  const time = d.toLocaleString(DateTime.TIME_SIMPLE).replace(/\u202f/g, " ");
  if (d.hasSame(now, "day")) return time;
  if (d.hasSame(now.minus({ days: 1 }), "day")) return `Yesterday ${time}`;
  if (now.diff(d, "days").days < 6) return `${d.toFormat("ccc")} ${time}`;
  return `${d.toFormat("d LLL")}, ${time}`;
}

/** Which messages get a time over them: the first one, and the first after each quiet gap. */
export function timeBreaks(messages: Timed[], o: { now?: Date; locale?: string; zone?: string } = {}): Map<string, string> {
  const opts = { now: o.now ?? new Date(), locale: o.locale, zone: o.zone };
  const out = new Map<string, string>();
  let last: number | null = null;
  for (const m of messages) {
    const t = atOf(m);
    if (t === null) continue;
    if (last === null || t - last >= GAP_MS) out.set(m.id, label(t, opts));
    last = t;
  }
  return out;
}
