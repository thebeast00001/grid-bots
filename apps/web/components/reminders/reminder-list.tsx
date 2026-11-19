"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Repeat2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { BotView, ReminderView } from "@/lib/client-types";
import { spring } from "@/lib/motion";
import { formatWhen, repeatLabel } from "@/lib/reminders/when";
import { ReminderForm, type ReminderInput } from "./reminder-form";
import { browserZone, refreshReminders, useNow, useReminders } from "./reminders-store";

/** The profile's Reminders section: everything upcoming for this bot, editable in place. */
export function ReminderList({ bot }: { bot: BotView }) {
  const list = useReminders(bot.id);
  const upcoming = (list ?? []).filter((r) => r.status === "scheduled").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const now = useNow();
  const zone = browserZone();

  const call = async (path: string, init: RequestInit, failure: string) => {
    try {
      await api(path, init);
      await refreshReminders(bot.id);
      return true;
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : failure);
      return false;
    }
  };

  const add = async (v: ReminderInput) => {
    if (await call("/api/reminders", { method: "POST", body: JSON.stringify({ botId: bot.id, ...v }) }, "Couldn't add that reminder.")) setAdding(false);
  };
  const change = async (r: ReminderView, v: ReminderInput) => {
    const body = { text: v.text, when: v.when || undefined, repeat: v.repeat };
    if (await call(`/api/reminders/${r.id}`, { method: "PATCH", body: JSON.stringify(body) }, "Couldn't change that reminder.")) setEditing(null);
  };

  return (
    <section aria-label="Reminders">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-[var(--text-2)]">Reminders</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            aria-label="Add a reminder"
            className="press hover-surface inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[var(--text-2)]"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-2">
          <ReminderForm initial={{ text: "", when: "", repeat: "none" }} submitLabel="Add" onSubmit={add} onCancel={() => setAdding(false)} />
        </div>
      )}

      {list !== null && upcoming.length === 0 && !adding && (
        <p className="text-[13px] text-[var(--text-3)]">No reminders yet. Ask {bot.name}: “remind me Friday at 6 to pay rent”.</p>
      )}

      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {upcoming.map((r) => (
            <motion.li
              key={r.id}
              layout
              data-testid="reminder-row"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={spring.snappy}
            >
              {editing === r.id ? (
                <ReminderForm
                  initial={{ text: r.text, when: "", repeat: r.repeat }}
                  whenHint={formatWhen(new Date(r.dueAt), { now, zone })}
                  submitLabel="Save"
                  onSubmit={(v) => change(r, v)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 edge">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[13.5px] font-medium">{r.text}</div>
                    <div className="tnum text-[12px] text-[var(--text-2)]">{formatWhen(new Date(r.dueAt), { now, zone })}</div>
                    {r.repeat !== "none" && (
                      <div className="flex items-center gap-1 text-[11.5px] text-[var(--text-3)]">
                        <Repeat2 size={11} /> {repeatLabel(r.repeat, new Date(r.dueAt), zone)}
                      </div>
                    )}
                  </div>
                  <button
                    aria-label="Change reminder"
                    title="Change"
                    onClick={() => setEditing(r.id)}
                    className="press grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    aria-label="Cancel reminder"
                    title="Cancel"
                    onClick={() => call(`/api/reminders/${r.id}`, { method: "DELETE" }, "Couldn't cancel that reminder.")}
                    className="press grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
