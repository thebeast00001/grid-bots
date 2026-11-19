"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Monitor, PanelRight } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import type { BotStatus } from "@/lib/bot-status-store";
import type { BotView } from "@/lib/client-types";
import { ease } from "@/lib/motion";

export type Pane = "computer" | "profile" | null;

/** The top of a chat: the bot, what it's doing right now, and its computer and profile. */
export function ChatHeader(p: {
  bot: BotView;
  status: BotStatus;
  subtitle?: string;
  mobile: boolean;
  pane: Pane;
  onPane: (pane: Pane) => void;
  onSkipInterview?: () => void;
}) {
  const { bot, status } = p;
  const text = status.text || p.subtitle || bot.job || `@${bot.handle}`;
  const busy = status.pose === "thinking" || status.pose === "working" || status.pose === "talking";
  const toggle = (which: Exclude<Pane, null>) => p.onPane(p.pane === which ? null : which);
  const btn = (on: boolean) => `press grid size-9 place-items-center rounded-xl ${on ? "bg-[var(--surface-3)] text-[var(--text)]" : "hover-surface text-[var(--text-2)]"}`;
  return (
    <header data-testid="chat-header" className="edge-b flex h-14 shrink-0 items-center gap-2.5 px-3 md:px-5">
      {p.mobile && (
        <Link href="/bots" aria-label="Back" className="press hover-surface -ml-1 grid size-9 place-items-center rounded-xl">
          <ArrowLeft size={18} />
        </Link>
      )}
      <Critter cfg={bot.avatar} size={30} pose={status.pose} label={bot.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{bot.name}</div>
        <div className="relative h-[17px] overflow-hidden text-[12.5px]" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={text}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="block truncate"
              style={{ color: busy ? "var(--text)" : "var(--text-2)" }}
            >
              {busy && <span aria-hidden className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full align-middle" style={{ background: "var(--bot)" }} />}
              {text}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
      {p.onSkipInterview && (
        <button onClick={p.onSkipInterview} className="press hover-surface rounded-full px-2.5 py-1 text-[12.5px] text-[var(--text-2)]">
          Skip interview
        </button>
      )}
      <button onClick={() => toggle("computer")} aria-label="Computer" aria-pressed={p.pane === "computer"} title={`${bot.name}'s computer`} className={btn(p.pane === "computer")}>
        <Monitor size={17} />
      </button>
      <button onClick={() => toggle("profile")} aria-label="Profile" aria-pressed={p.pane === "profile"} title="Profile" className={btn(p.pane === "profile")}>
        <PanelRight size={17} />
      </button>
    </header>
  );
}
