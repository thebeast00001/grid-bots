import * as chrono from "chrono-node";
import { DateTime, type DurationUnit } from "luxon";

/**
 * Plain-words times for reminders, shared by the server (tools, scheduler) and the
 * browser (live preview while typing). Times are instants; everything a person sees
 * or says is read in their time zone.
 */

export const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];

type Ctx = { now: Date; zone: string };
export type Parsed = { at: Date; timeGuessed: boolean } | { error: "unclear" | "past" };

/** A date said without a time means this hour. */
const DEFAULT_HOUR = 9;

const inZone = (d: Date, zone: string) => DateTime.fromJSDate(d, { zone });

export function parseWhen(text: string, { now, zone }: Ctx): Parsed {
  const t = text.trim();
  if (!t) return { error: "unclear" };
  const ref = inZone(now, zone);
  const [r] = chrono.parse(t, { instant: now, timezone: ref.offset }, { forwardDate: true });
  if (!r) return { error: "unclear" };
  const s = r.start;

  // "in 3 hours": chrono already has the exact instant.
  if (s.tags().has("result/relativeDate")) {
    const at = s.date();
    return at > now ? { at, timeGuessed: false } : { error: "past" };
  }

  const hourSaid = s.isCertain("hour");
  const daySaid = s.isCertain("day") || s.isCertain("weekday");
  const wall = (day: DateTime, hour: number) =>
    day.set({ hour, minute: hourSaid ? (s.get("minute") ?? 0) : 0, second: 0, millisecond: 0 });
  // Rebuild from the wall-clock parts in the user's zone, so a date across a DST change keeps its hour.
  const day = DateTime.fromObject({ year: s.get("year")!, month: s.get("month")!, day: s.get("day")! }, { zone });
  const hour = hourSaid ? s.get("hour")! : DEFAULT_HOUR;
  let at = wall(day, hour);

  if (hourSaid && !s.isCertain("meridiem") && hour >= 1 && hour < 12) {
    if (!daySaid) {
      // "at 6": the next 6 o'clock, morning or evening, from now.
      const today = ref.startOf("day");
      const options = [wall(today, hour), wall(today, hour + 12), wall(today.plus({ days: 1 }), hour)];
      at = options.find((o) => o > ref) ?? at;
    } else if (hour <= 6) {
      // "Friday at 6" means the evening.
      at = wall(day, hour + 12);
    }
  }
  const instant = at.toJSDate();
  return instant > now ? { at: instant, timeGuessed: !hourSaid } : { error: "past" };
}

/** The repeat a phrase asks for ("every day at 9" → daily), or null. */
export function parseRepeat(text: string): Repeat | null {
  const t = text.toLowerCase();
  if (/\b(every|each)\s+weekday|\bweekdays\b|\bmon(day)?\s*(to|-|through|till)\s*fri(day)?\b/.test(t)) return "weekdays";
  if (/\b(every|each)\s+(day|morning|evening|night)\b|\bdaily\b|\bevery\s*day\b/.test(t)) return "daily";
  if (/\b(every|each)\s+(week|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b|\bweekly\b/.test(t)) return "weekly";
  if (/\b(every|each)\s+month\b|\bmonthly\b/.test(t)) return "monthly";
  if (/\b(every|each)\s+year\b|\byearly\b|\bannually\b/.test(t)) return "yearly";
  return null;
}

const STEP: Record<Exclude<Repeat, "none">, DurationUnit> = {
  daily: "days",
  weekdays: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

/**
 * The first occurrence strictly after `after`. Each one is the anchor plus n steps
 * (never the previous occurrence plus one), so the 31st comes back after February.
 */
export function nextOccurrence(anchor: Date, repeat: Repeat, after: Date, zone: string): Date | null {
  if (repeat === "none") return null;
  const unit = STEP[repeat];
  const a = inZone(anchor, zone);
  const elapsed = Math.floor(inZone(after, zone).diff(a, unit).get(unit));
  for (let n = Math.max(1, elapsed - 1); ; n++) {
    const d = a.plus({ [unit]: n });
    if (repeat === "weekdays" && d.weekday > 5) continue;
    if (d.toJSDate() > after) return d.toJSDate();
  }
}

const time = (d: DateTime) => d.setLocale("en-US").toFormat("h:mm a");

/** "Today, 6:00 PM", "Tomorrow, 9:00 AM", "Sat 21 Nov, 6:00 PM", "21 Nov 2027, 9:00 AM". */
export function formatWhen(at: Date, { now, zone }: Ctx): string {
  const d = inZone(at, zone).setLocale("en-US");
  const days = Math.round(d.startOf("day").diff(inZone(now, zone).startOf("day"), "days").days);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : d.year === inZone(now, zone).year
            ? d.toFormat("ccc d LLL")
            : d.toFormat("d LLL yyyy");
  return `${day}, ${time(d)}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "Every day at 9:00 AM", "Every month on the 1st at 9:00 AM"…; null when it doesn't repeat. */
export function repeatLabel(repeat: Repeat, anchor: Date, zone: string): string | null {
  const d = inZone(anchor, zone).setLocale("en-US");
  switch (repeat) {
    case "none":
      return null;
    case "daily":
      return `Every day at ${time(d)}`;
    case "weekdays":
      return `Weekdays at ${time(d)}`;
    case "weekly":
      return `Every ${d.toFormat("cccc")} at ${time(d)}`;
    case "monthly":
      return `Every month on the ${ordinal(d.day)} at ${time(d)}`;
    case "yearly":
      return `Every year on ${d.toFormat("d LLL")} at ${time(d)}`;
  }
}

export type SnoozePreset = "10m" | "1h" | "evening" | "tomorrow";
export const SNOOZE_PRESETS: { id: SnoozePreset; label: string }[] = [
  { id: "10m", label: "10 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "evening", label: "This evening" },
  { id: "tomorrow", label: "Tomorrow 9 AM" },
];

export function snoozeUntil(preset: SnoozePreset, { now, zone }: Ctx): Date {
  const local = inZone(now, zone);
  switch (preset) {
    case "10m":
      return new Date(now.getTime() + 10 * 60_000);
    case "1h":
      return new Date(now.getTime() + 60 * 60_000);
    case "evening":
      // 6 PM, or three hours from now once it's already evening.
      return local.hour < 17 ? local.set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).toJSDate() : new Date(now.getTime() + 3 * 3_600_000);
    case "tomorrow":
      return local.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  }
}
