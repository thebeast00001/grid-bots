"use client";

import Link from "next/link";
import { Cpu, ListChecks, Plus } from "lucide-react";
import { Critter } from "@/components/critter/critter";
import { InboxButton } from "@/components/notifications/inbox";
import { useBotStatus } from "@/lib/bot-status-store";
import type { BotView } from "@/lib/client-types";
import { BotList } from "./bot-list";
import { useBots } from "./bots-store";

function Pinned({ bot }: { bot: BotView }) {
  const status = useBotStatus(bot.id);
  return (
    <Link href={`/bots/${bot.id}`} className="press flex flex-col items-center gap-1 rounded-2xl py-2" aria-label={`${bot.name} (pinned)`}>
      <Critter cfg={bot.avatar} size={72} pose={status.pose} label="" />
      <span className="max-w-[90px] truncate text-[12.5px] font-medium text-[var(--text-2)]">{bot.name}</span>
    </Link>
  );
}

/** Phone home: the three most recent bots as big avatars, then the full list (UI.md #26). */
export function PhoneHome() {
  const { bots } = useBots();
  const top = (bots ?? []).slice(0, 3);
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="text-[20px] font-semibold tracking-tight">Grid</span>
        <div className="flex gap-1">
          <InboxButton phone />
          <Link href="/lists" aria-label="Lists" className="press hover-surface grid size-10 place-items-center rounded-full">
            <ListChecks size={20} />
          </Link>
          <Link href="/settings/models" aria-label="Models" className="press hover-surface grid size-10 place-items-center rounded-full">
            <Cpu size={19} />
          </Link>
          <Link href="/new" aria-label="New bot" className="press hover-surface grid size-10 place-items-center rounded-full">
            <Plus size={21} />
          </Link>
        </div>
      </header>
      {top.length > 0 && (
        <div className="grid shrink-0 grid-cols-3 gap-2 px-4 pb-1">
          {top.map((b) => (
            <Pinned key={b.id} bot={b} />
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <BotList compact />
      </div>
    </div>
  );
}
