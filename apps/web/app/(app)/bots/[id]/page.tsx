"use client";

import { use } from "react";
import { motion } from "motion/react";
import { Critter } from "@/components/critter/critter";
import { useBots } from "@/components/shell/bots-store";
import { botVars } from "@/lib/critter/palette";
import { spring } from "@/lib/motion";

/** Bot page. The chat itself arrives in Task 9. */
export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bots } = useBots();
  const bot = bots?.find((b) => b.id === id);

  if (bots && !bot) {
    return <div className="grid w-full place-items-center text-[var(--text-2)]">This bot doesn&apos;t exist.</div>;
  }
  if (!bot) return null;

  return (
    <div className="flex w-full flex-col items-center pt-4" style={botVars(bot.avatar.color)}>
      <motion.div layoutId={`presence-${bot.id}`} transition={spring.smooth}>
        <Critter cfg={bot.avatar} size={92} track pettable label={bot.name} />
      </motion.div>
      <div className="mt-1 text-[15px] font-semibold">{bot.name}</div>
      <div className="text-[13px] text-[var(--text-2)]">{bot.job}</div>
    </div>
  );
}
