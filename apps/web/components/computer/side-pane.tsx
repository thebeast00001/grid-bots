"use client";

import { X } from "lucide-react";
import { ReminderList } from "@/components/reminders/reminder-list";
import { RoutineList } from "@/components/routines/routine-list";
import type { BotView } from "@/lib/client-types";

/** The right side of a chat: the bot's computer, then its routines and reminders. */
export function SidePane({ bot, onClose, screen }: { bot: BotView; onClose: () => void; screen?: React.ReactNode }) {
  return (
    <aside aria-label={`${bot.name}'s computer`} className="thin-scroll flex h-full flex-col overflow-y-auto">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="flex-1 text-[14px] font-semibold">{bot.name}&apos;s computer</span>
        <button onClick={onClose} aria-label="Close computer" className="press hover-surface grid size-8 place-items-center rounded-lg text-[var(--text-2)]">
          <X size={16} />
        </button>
      </div>
      <div className="px-4 pb-6">
        {screen}
        <div className="mt-5">
          <RoutineList bot={bot} />
        </div>
        <div className="mt-5">
          <ReminderList bot={bot} />
        </div>
      </div>
    </aside>
  );
}
