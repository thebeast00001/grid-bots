"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ListChecks, Plus, Search, Settings2 } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import { useBotStatus } from "@/lib/bot-status-store";
import type { BotView } from "@/lib/client-types";
import { botVars } from "@/lib/critter/palette";
import { spring } from "@/lib/motion";
import { InboxButton } from "@/components/notifications/inbox";
import { useInbox } from "@/components/notifications/notifications-store";
import { GridMark, ThemeToggle } from "./theme-toggle";
import { useBots } from "./bots-store";

export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Row({ bot, active, size, unread }: { bot: BotView; active: boolean; size: number; unread: boolean }) {
  const status = useBotStatus(bot.id);
  const line = status.text || bot.preview || bot.job || "New bot";
  return (
    <Link
      href={`/bots/${bot.id}`}
      className={`press ${active ? "" : "hover-surface"} flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left`}
      style={{ ...botVars(bot.avatar.color), background: active ? "var(--surface-2)" : undefined }}
      aria-current={active ? "page" : undefined}
    >
      <Critter cfg={bot.avatar} size={size} pose={status.pose} label="" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{bot.name}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="tnum text-[12px] text-[var(--text-3)]">{formatWhen(bot.updatedAt)}</span>
            {unread && <span data-testid="unread" aria-label="New message" className="size-2.5 rounded-full" style={{ background: "var(--bot)" }} />}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-[var(--text-2)]">{line}</span>
          {bot.interview === "pending" && (
            <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
              New
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** `compact`: the phone list screen (bigger rows, no New bot button of its own). */
export function BotList({ compact = false }: { compact?: boolean }) {
  const { bots } = useBots();
  const { unread } = useInbox();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const shown = (bots ?? []).filter((b) => `${b.name} ${b.job}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <label className="field flex h-9 flex-1 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 text-[var(--text-3)]">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search bots"
            className="w-full bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
        </label>
        {/* On phones the list screen's header already has these. */}
        {!compact && <InboxButton />}
        {!compact && (
          <Link href="/new" className="press hover-surface grid size-9 place-items-center rounded-xl" aria-label="New bot" title="New bot">
            <Plus size={19} />
          </Link>
        )}
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {bots !== null && bots.length === 0 && (
          <Link href="/new" className="press hover-surface mt-2 flex items-center gap-3 rounded-2xl px-2.5 py-3 text-[var(--text-2)]">
            <span className="grid size-10 place-items-center rounded-full border border-dashed border-[var(--edge-strong)]">
              <Plus size={18} />
            </span>
            Make your first bot
          </Link>
        )}
        <AnimatePresence initial={false}>
          {shown.map((b) => (
            <motion.div key={b.id} layout="position" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.smooth}>
              <Row bot={b} active={pathname === `/bots/${b.id}`} size={compact ? 48 : 42} unread={!!unread.byBot[b.id] && pathname !== `/bots/${b.id}`} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!compact && (
        <nav aria-label="Places" className="edge-t flex flex-col gap-0.5 px-2 py-2">
          <Place href="/lists" icon={<ListChecks size={17} />} label="Lists" active={pathname.startsWith("/lists")} />
          <Place href="/settings/models" icon={<Settings2 size={17} />} label="Settings" active={pathname.startsWith("/settings")} />
          <div className="mt-1 flex items-center gap-2 px-2.5 text-[12.5px] text-[var(--text-3)]">
            <GridMark size={16} />
            <span className="flex-1">Grid</span>
            <ThemeToggle />
          </div>
        </nav>
      )}
    </div>
  );
}

function Place({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`press flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] ${active ? "bg-[var(--surface-2)] text-[var(--text)]" : "hover-surface text-[var(--text-2)]"}`}>
      {icon}
      {label}
    </Link>
  );
}
