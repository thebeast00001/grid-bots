"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api-client";
import type { NotificationView } from "@/lib/client-types";

/** The inbox as the server has it: recent notifications and unread counts per bot. */

export type Inbox = { items: NotificationView[] | null; unread: { total: number; byBot: Record<string, number> } };

const EMPTY: Inbox = { items: null, unread: { total: 0, byBot: {} } };
let state: Inbox = EMPTY;
const listeners = new Set<() => void>();
const set = (next: Inbox) => {
  state = next;
  listeners.forEach((l) => l());
};

// One fetch at a time. `stale` is set when something changes (here, or on the server) while
// it's in flight; its answer is then dropped and it asks again, so an old answer can't undo
// a newer change.
let running: Promise<void> | null = null;
let stale = false;
const changedLocally = () => {
  if (running) stale = true;
};

export function refreshInbox(): Promise<void> {
  stale = true;
  running ??= (async () => {
    try {
      while (stale) {
        stale = false;
        const r = await api<{ notifications: NotificationView[]; unread: Inbox["unread"] }>("/api/notifications");
        if (!stale) set({ items: r.notifications, unread: r.unread });
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

/** First load: joins one already on its way instead of starting another. */
export function loadInbox(): Promise<void> {
  if (running || state.items !== null) return running ?? Promise.resolve();
  return refreshInbox();
}

export const getInboxForTests = (): Inbox => state;

/** A notification the server just announced. */
export function addNotification(n: NotificationView): void {
  if (state.items?.some((x) => x.id === n.id)) return;
  changedLocally();
  const byBot = { ...state.unread.byBot };
  let total = state.unread.total;
  if (!n.readAt) {
    byBot[n.botId] = (byBot[n.botId] ?? 0) + 1;
    total += 1;
  }
  set({ items: [n, ...(state.items ?? [])].slice(0, 100), unread: { total, byBot } });
}

function markLocally(match: (n: NotificationView) => boolean) {
  changedLocally();
  const now = new Date().toISOString();
  const byBot = { ...state.unread.byBot };
  let total = state.unread.total;
  const items = state.items?.map((n) => {
    if (n.readAt || !match(n)) return n;
    byBot[n.botId] = Math.max(0, (byBot[n.botId] ?? 1) - 1);
    if (!byBot[n.botId]) delete byBot[n.botId];
    total = Math.max(0, total - 1);
    return { ...n, readAt: now };
  });
  set({ items: items ?? null, unread: { total, byBot } });
}

/** Opening a bot's chat reads its notifications (even before the inbox has loaded: a tapped push opens the chat cold). */
export async function markBotRead(botId: string): Promise<void> {
  if (state.items !== null && !state.unread.byBot[botId]) return;
  const byBot = { ...state.unread.byBot };
  const total = Math.max(0, state.unread.total - (byBot[botId] ?? 0));
  delete byBot[botId];
  markLocally((n) => n.botId === botId);
  set({ ...state, unread: { total, byBot } });
  await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ botId }) }).catch(() => {});
}

export async function markAllRead(): Promise<void> {
  markLocally(() => true);
  set({ ...state, unread: { total: 0, byBot: {} } });
  await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useInbox(): Inbox {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    loadInbox().catch(() => {});
  }, []);
  return s;
}
