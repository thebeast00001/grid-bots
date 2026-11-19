"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshReminders } from "@/components/reminders/reminders-store";
import { addNotification, refreshInbox, useInbox } from "@/components/notifications/notifications-store";
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
 * Listens to /api/events for the whole app. A notification (a reminder going off, a routine
 * result) goes to the inbox; if it pings, it shows as a toast, or as a system notification
 * when Grid isn't in front. Also tells the server the browser's time zone.
 */
export function LiveEvents() {
  const { refresh } = useBots();
  const { unread } = useInbox();
  const pathname = usePathname();
  const router = useRouter();
  const where = useRef(pathname);
  where.current = pathname;
  const actions = useRef({ refresh, push: router.push });
  actions.current = { refresh, push: router.push };

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api<{ timezone: string | null }>("/api/settings")
      .then((s) => (s.timezone === zone ? null : api("/api/settings", { method: "PATCH", body: JSON.stringify({ timezone: zone }) })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    // (Re)connected: catch up on anything missed while the stream was down.
    source.onopen = () => void refreshInbox().catch(() => {});
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
      if (e.type === "inbox") {
        refreshInbox().catch(() => {});
        return;
      }
      if (e.type === "notification") {
        const n = e.notification;
        addNotification(n);
        void actions.current.refresh().catch(() => {});
        const url = `/bots/${n.botId}`;
        const visible = document.visibilityState === "visible";
        // The open, visible chat shows it already (and marks it read).
        if (!n.ping || (visible && where.current === url)) return;
        if (visible) toast(`${n.title}: ${n.body}`, { action: { label: "Open", onClick: () => actions.current.push(url) } });
        else void systemNotify(n.title, n.body, url);
        return;
      }
      if (e.type === "run") {
        // The open chat shows this itself; the list shows it for every other bot.
        if (where.current !== `/bots/${e.botId}`) setBotStatus(e.botId, e.status === "running" ? { pose: "working", text: `Working on ${e.name}…` } : { pose: "idle", text: "" });
        return;
      }
      // A plain `message` event only updates the open chat (see ChatView).
    };
    return () => source.close();
  }, []);

  // "(2) Grid" while something is unread. Re-applied after navigation, which resets the title.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = unread.total ? `(${unread.total}) ${base}` : base;
  }, [unread.total, pathname]);

  return null;
}
