"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Search } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import { useBotStatus } from "@/lib/bot-status-store";
import type { BotView } from "@/lib/client-types";
import { botVars } from "@/lib/critter/palette";
import { spring } from "@/lib/motion";
import { useBots } from "./bots-store";

export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Row({ bot, active, size }: { bot: BotView; active: boolean; size: number }) {
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
          <span className="tnum shrink-0 text-[12px] text-[var(--text-3)]">{formatWhen(bot.updatedAt)}</span>
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
        {/* On phones the list screen's header already has one. */}
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
              <Row bot={b} active={pathname === `/bots/${b.id}`} size={compact ? 48 : 42} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
