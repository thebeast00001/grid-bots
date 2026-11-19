"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshReminders } from "@/components/reminders/reminders-store";
import { refreshRoutines } from "@/components/routines/routines-store";
import { setBotStatus } from "@/lib/bot-status-store";
import { api } from "@/lib/api-client";
import type { GridEvent } from "@/lib/events";
import { useBots } from "./bots-store";

/** Everyone in the app who wants to hear server events (the open chat, mainly). */
const listeners = new Set<(e: GridEvent) => void>();

/** Calls `fn` for each server event while the component is mounted. */
export function useLiveEvent(fn: (e: GridEvent) => void): void {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const l = (e: GridEvent) => latest.current(e);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
}

/** A system notification, through the service worker when there is one (phones need that). */
async function systemNotify(title: string, body: string, url: string): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body, tag: url, icon: "/icons/icon-192.png", data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(title, options);
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      window.location.assign(url);
    };
  } catch {
    // Notifications blocked or unsupported here; the toast and unread dot still show.
  }
}

/**
 * Listens to /api/events for the whole app: a bot that writes on its own (a reminder
 * going off) gets an unread dot, a toast and, when Grid isn't in front, a system
 * notification. Also tells the server the browser's time zone.
 */
export function LiveEvents() {
  const { markUnread, refresh, unread } = useBots();
  const pathname = usePathname();
  const router = useRouter();
  const where = useRef(pathname);
  where.current = pathname;
  const actions = useRef({ markUnread, refresh, push: router.push });
  actions.current = { markUnread, refresh, push: router.push };

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api<{ timezone: string | null }>("/api/settings")
      .then((s) => (s.timezone === zone ? null : api("/api/settings", { method: "PATCH", body: JSON.stringify({ timezone: zone }) })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (ev) => {
      let e: GridEvent;
      try {
        e = JSON.parse(ev.data) as GridEvent;
      } catch {
        return;
      }
      for (const l of listeners) l(e);
      if (e.type === "reminders") {
        refreshReminders(e.botId).catch(() => {});
        return;
      }
      if (e.type === "routines") {
        refreshRoutines(e.botId).catch(() => {});
        return;
      }
      if (e.type === "notification") return;
      if (e.type === "run") {
        // The open chat shows this itself; the list shows it for every other bot.
        if (where.current !== `/bots/${e.botId}`) setBotStatus(e.botId, e.status === "running" ? { pose: "working", text: `Working on ${e.name}…` } : { pose: "idle", text: "" });
        return;
      }
      const url = `/bots/${e.botId}`;
      const open = where.current === url;
      const visible = document.visibilityState === "visible";
      void actions.current.refresh().catch(() => {});
      if (open && visible) return;
      actions.current.markUnread(e.botId);
      const title = e.title ?? "Grid";
      const body = e.body ?? "New message";
      if (visible) toast(`${title}: ${body}`, { action: { label: "Open", onClick: () => actions.current.push(url) } });
      else void systemNotify(title, body, url);
    };
    return () => source.close();
  }, []);

  // "(2) Grid" while something is unread. Re-applied after navigation, which resets the title.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = unread.size ? `(${unread.size}) ${base}` : base;
  }, [unread, pathname]);

  return null;
}
