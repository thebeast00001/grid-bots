"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api-client";
import type { RoutineView } from "@/lib/client-types";

/** Each bot's routines as the server has them; refreshed after changes and on `routines` events. */

const cache = new Map<string, RoutineView[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshRoutines(botId: string): Promise<void> {
  const r = await api<{ routines: RoutineView[] }>(`/api/routines?botId=${encodeURIComponent(botId)}`);
  cache.set(botId, r.routines);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRoutines(botId: string): RoutineView[] | null {
  const list = useSyncExternalStore(
    subscribe,
    () => cache.get(botId) ?? null,
    () => null,
  );
  useEffect(() => {
    if (!cache.has(botId)) refreshRoutines(botId).catch(() => {});
  }, [botId]);
  return list;
}

/** Starts a run now; the result arrives in the chat. Resolves to an error message, or null. */
export async function runNow(routineId: string, botId: string): Promise<string | null> {
  try {
    await api(`/api/routines/${routineId}/run`, { method: "POST" });
    await refreshRoutines(botId);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Couldn't start it.";
  }
}

export const PRESETS = [
  {
    name: "Morning briefing",
    when: "every weekday at 8am",
    instruction: "Give me a short briefing for the day: my upcoming reminders, anything I asked you to keep an eye on, and one thing worth focusing on.",
  },
  {
    name: "Evening check-in",
    when: "every day at 9pm",
    instruction: "Ask how my day went and what's on my mind for tomorrow. Offer to set reminders for anything I mention.",
  },
  {
    name: "Weekly review",
    when: "every sunday at 6pm",
    instruction: "Help me review my week: what went well, what didn't, and what to plan for next week.",
  },
] as const;
