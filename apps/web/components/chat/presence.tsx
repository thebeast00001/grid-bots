"use client";

import { AnimatePresence, motion } from "motion/react";
import { Critter } from "@/components/critter/critter";
import type { BotStatus } from "@/lib/bot-status-store";
import type { BotView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";

/** The bot floating at the top of its chat, with a live status line (UI.md #13). */
export function Presence({ bot, status, size, subtitle }: { bot: BotView; status: BotStatus; size: number; subtitle?: string }) {
  const text = status.text || subtitle || bot.job || `@${bot.handle}`;
  const busy = status.pose === "thinking" || status.pose === "working";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center pt-2">
      <motion.div layoutId={`presence-${bot.id}`} transition={spring.smooth} className="pointer-events-auto">
        <Critter cfg={bot.avatar} size={size} pose={status.pose} track pettable label={bot.name} />
      </motion.div>
      <div className="mt-0.5 text-[15px] font-semibold">{bot.name}</div>
      <div
        className="mt-1 flex h-7 items-center overflow-hidden rounded-full px-3 text-[12.5px]"
        style={{ background: busy ? "color-mix(in oklch, var(--bot) 14%, var(--surface))" : "transparent", color: "var(--text-2)" }}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ opacity: 0, y: 5, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -5, filter: "blur(4px)" }}
            transition={{ duration: 0.18, ease: ease.out }}
            className="whitespace-nowrap"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
