"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { browserZone, useNow } from "@/components/reminders/reminders-store";
import { useBots } from "@/components/shell/bots-store";
import { api } from "@/lib/api-client";
import type { BotView } from "@/lib/client-types";
import { spring } from "@/lib/motion";
import { formatWhen } from "@/lib/reminders/when";

const CHOICES = [
  { id: "1h", label: "1 hour" },
  { id: "tomorrow", label: "Until tomorrow 9 AM" },
  { id: "forever", label: "Until I turn them back on" },
] as const;

/** The profile's Notifications row: on, or muted until a time. */
export function MuteControl({ bot }: { bot: BotView }) {
  const { upsert } = useBots();
  const now = useNow();
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const until = bot.mutedUntil ? new Date(bot.mutedUntil) : null;
  const muted = until !== null && until > now;

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const mute = async (choice: (typeof CHOICES)[number]["id"] | null) => {
    setMenu(false);
    try {
      upsert(await api<BotView>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ mute: choice }) }));
    } catch {
      toast("Couldn't change that.");
    }
  };

  return (
    <section>
      <h2 className="mb-1 text-[13px] font-medium text-[var(--text-2)]">Notifications</h2>
      <div ref={box} className="relative flex items-center gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 edge">
        {muted ? <BellOff size={15} className="text-[var(--text-3)]" /> : <Bell size={15} className="text-[var(--text-3)]" />}
        <span className="tnum min-w-0 flex-1 text-[13.5px]">
          {!muted ? "On" : until!.getUTCFullYear() >= 9999 ? "Muted" : `Muted until ${formatWhen(until!, { now, zone: browserZone() }).replace(/^Today, /, "")}`}
        </span>
        {muted ? (
          <button onClick={() => mute(null)} className="press rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12.5px] font-medium">
            Unmute
          </button>
        ) : (
          <button aria-haspopup="menu" aria-expanded={menu} aria-label="Mute notifications" onClick={() => setMenu((m) => !m)} className="press rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12.5px] font-medium">
            Mute…
          </button>
        )}
        <AnimatePresence>
          {menu && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
              transition={spring.snappy}
              style={{ transformOrigin: "top right" }}
              className="absolute right-0 top-full z-20 mt-1.5 flex w-56 flex-col rounded-2xl bg-[var(--surface)] p-1 edge"
            >
              {CHOICES.map((c) => (
                <button key={c.id} role="menuitem" onClick={() => mute(c.id)} className="press rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]">
                  {c.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-3)]">Muted notifications still land in your inbox, they just don&apos;t ping you.</p>
    </section>
  );
}
