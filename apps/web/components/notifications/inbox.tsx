"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import { browserZone, useNow } from "@/components/reminders/reminders-store";
import { useBots } from "@/components/shell/bots-store";
import { Sheet } from "@/components/shell/sheet";
import type { NotificationView } from "@/lib/client-types";
import { botVars } from "@/lib/critter/palette";
import { spring } from "@/lib/motion";
import { formatWhen } from "@/lib/reminders/when";
import { markAllRead, useInbox } from "./notifications-store";

const REASON: Record<NonNullable<NotificationView["reason"]>, string> = {
  muted: "Muted",
  "quiet-hours": "Quiet hours",
  "not-important": "Not important",
};

/** The bell: unread count, opens the inbox (a panel beside the rail, a sheet on phones). */
export function InboxButton({ phone = false }: { phone?: boolean }) {
  const { unread } = useInbox();
  const [open, setOpen] = useState(false);
  const n = unread.total;
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={n ? `Notifications, ${n} unread` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
        className={`press hover-surface relative grid size-10 place-items-center ${phone ? "rounded-full" : "rounded-xl"} text-[var(--text-3)]`}
      >
        <Bell size={phone ? 19 : 18} />
        {n > 0 && (
          <span data-testid="inbox-count" className="tnum absolute left-1/2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold leading-none text-white">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
      {phone ? (
        <AnimatePresence>
          {open && (
            <Sheet label="Notifications" onClose={() => setOpen(false)}>
              <InboxPanel onClose={() => setOpen(false)} />
            </Sheet>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>{open && <Popover onClose={() => setOpen(false)} />}</AnimatePresence>
      )}
    </>
  );
}

function Popover({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[aria-label^="Notifications"]')) onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);
  return (
    <motion.div
      ref={box}
      role="dialog"
      aria-label="Notifications"
      initial={{ opacity: 0, x: -6, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
      transition={spring.snappy}
      style={{ transformOrigin: "top left" }}
      className="fixed left-[68px] top-3 z-50 flex max-h-[min(640px,85vh)] w-[380px] flex-col overflow-hidden rounded-[22px] bg-[var(--panel)] edge"
    >
      <InboxPanel onClose={onClose} />
    </motion.div>
  );
}

function InboxPanel({ onClose }: { onClose: () => void }) {
  const { items, unread } = useInbox();
  const { bots } = useBots();
  const router = useRouter();
  const now = useNow();
  const zone = browserZone();
  const today = new Date(now).toDateString();
  const groups: [string, NotificationView[]][] = [
    ["Today", (items ?? []).filter((n) => new Date(n.createdAt).toDateString() === today)],
    ["Earlier", (items ?? []).filter((n) => new Date(n.createdAt).toDateString() !== today)],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2 pt-3">
        <h2 className="flex-1 text-[15px] font-semibold">Notifications</h2>
        {unread.total > 0 && (
          <button onClick={() => void markAllRead()} className="press hover-surface inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[var(--text-2)]">
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
        <Link href="/settings/notifications" onClick={onClose} aria-label="Notification settings" title="Settings" className="press hover-surface grid size-8 place-items-center rounded-full text-[var(--text-2)]">
          <Settings2 size={15} />
        </Link>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {items !== null && items.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-[var(--text-3)]">Nothing yet. Reminders and routine results land here.</p>
        )}
        {groups.map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label}>
                <h3 className="px-2 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--text-3)]">{label}</h3>
                {list.map((n) => {
                  const bot = bots?.find((b) => b.id === n.botId);
                  return (
                    <button
                      key={n.id}
                      data-testid="inbox-item"
                      onClick={() => {
                        onClose();
                        router.push(`/bots/${n.botId}`);
                      }}
                      className="press hover-surface flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-left"
                      style={bot ? botVars(bot.avatar.color) : undefined}
                    >
                      {bot ? <Critter cfg={bot.avatar} size={34} label="" /> : <span className="size-[34px] shrink-0 rounded-full bg-[var(--surface-2)]" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[13.5px] font-semibold">{n.title}</span>
                          <span className="tnum ml-auto shrink-0 text-[11.5px] text-[var(--text-3)]">{formatWhen(new Date(n.createdAt), { now, zone }).replace(/^Today, /, "")}</span>
                        </span>
                        <span className={`line-clamp-2 break-words text-[13px] ${n.readAt ? "text-[var(--text-2)]" : "text-[var(--text)]"}`}>{n.body}</span>
                        {!n.ping && n.reason && (
                          <span className="mt-1 inline-block rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text-2)]">{REASON[n.reason]}</span>
                        )}
                      </span>
                      {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: "var(--bot)" }} />}
                    </button>
                  );
                })}
              </section>
            ),
        )}
      </div>
    </div>
  );
}
