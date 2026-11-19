"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api-client";
import type { ReminderView } from "@/lib/client-types";

/**
 * Each bot's reminders as the server has them, shared by the chat's cards and the
 * profile list. Refreshed after every change and whenever the server says a bot's
 * reminders changed (see LiveEvents).
 */

const cache = new Map<string, ReminderView[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshReminders(botId: string): Promise<void> {
  const r = await api<{ reminders: ReminderView[] }>(`/api/reminders?botId=${encodeURIComponent(botId)}`);
  cache.set(botId, r.reminders);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** All of a bot's reminders (any status), or null until loaded. */
export function useReminders(botId: string): ReminderView[] | null {
  const list = useSyncExternalStore(
    subscribe,
    () => cache.get(botId) ?? null,
    () => null,
  );
  useEffect(() => {
    if (!cache.has(botId)) refreshReminders(botId).catch(() => {});
  }, [botId]);
  return list;
}

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The current time, ticking every `ms`, so "in 5 min" stays true. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "in a moment", "in 25 min", "in 3 h", "in 4 days". */
export function relative(at: Date, now: Date): string {
  const min = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (min < 1) return "in a moment";
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} h`;
  return `in ${Math.round(h / 24)} days`;
}
