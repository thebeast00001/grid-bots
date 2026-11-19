import { DateTime } from "luxon";

/** When something a bot did on its own should ping you, and why not when it shouldn't. */

export type Importance = "high" | "normal" | "low";
/** all: every result · skip-quiet: not the low ones (default) · important: only high ones. */
export type PingFor = "all" | "skip-quiet" | "important";
export const PING_FOR: readonly PingFor[] = ["all", "skip-quiet", "important"];
export type QuietHours = { from: string; to: string } | null;
export type NotificationKind = "reminder" | "routine" | "routine-failed";
export type QuietReason = "muted" | "quiet-hours" | "not-important";

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Is `at` inside the daily quiet window (read on the user's wall clock; may cross midnight)? */
export function inQuietHours(at: Date, q: QuietHours, zone: string): boolean {
  if (!q) return false;
  const d = DateTime.fromJSDate(at, { zone });
  const now = d.hour * 60 + d.minute;
  const from = minutes(q.from);
  const to = minutes(q.to);
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

const LEVELS: Record<PingFor, Importance[]> = {
  all: ["high", "normal", "low"],
  "skip-quiet": ["high", "normal"],
  important: ["high"],
};

/**
 * In order: a muted bot never pings · a reminder always does (you picked the time) ·
 * quiet hours hold everything else · a failed routine pings · otherwise importance
 * against the chosen level.
 */
export function shouldPing(p: {
  kind: NotificationKind;
  importance: Importance;
  mutedUntil: Date | null;
  at: Date;
  quietHours: QuietHours;
  pingFor: PingFor;
  zone: string;
}): { ping: true } | { ping: false; reason: QuietReason } {
  if (p.mutedUntil && p.mutedUntil > p.at) return { ping: false, reason: "muted" };
  if (p.kind === "reminder") return { ping: true };
  if (inQuietHours(p.at, p.quietHours, p.zone)) return { ping: false, reason: "quiet-hours" };
  if (p.kind === "routine-failed") return { ping: true };
  return LEVELS[p.pingFor].includes(p.importance) ? { ping: true } : { ping: false, reason: "not-important" };
}
