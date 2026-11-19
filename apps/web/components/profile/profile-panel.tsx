"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Pencil, X } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Critter } from "@/components/critter/critter";
import { ModelPicker } from "@/components/models/model-picker";
import { ReminderList } from "@/components/reminders/reminder-list";
import { useBots } from "@/components/shell/bots-store";
import { api } from "@/lib/api-client";
import type { BotView } from "@/lib/client-types";

/** Who the bot is: job, soul, standing instructions, reminders, memory (children), model. */
export function ProfilePanel({ bot, onClose, children }: { bot: BotView; onClose: () => void; children?: React.ReactNode }) {
  const { upsert } = useBots();
  const [job, setJob] = useState(bot.job);
  const [editingSoul, setEditingSoul] = useState(false);
  const [soul, setSoul] = useState(bot.soul);

  useEffect(() => setJob(bot.job), [bot.job]);
  useEffect(() => {
    if (!editingSoul) setSoul(bot.soul);
  }, [bot.soul, editingSoul]);

  const patch = async (body: Partial<BotView>) => {
    try {
      upsert(await api<BotView>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify(body) }));
    } catch {
      toast("Couldn't save that.");
    }
  };

  return (
    <aside aria-label={`${bot.name}'s profile`} className="thin-scroll flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Critter cfg={bot.avatar} size={44} label="" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{bot.name}</div>
          <div className="text-[12.5px] text-[var(--text-3)]">@{bot.handle}</div>
        </div>
        <button onClick={onClose} aria-label="Close profile" className="press hover-surface grid size-8 place-items-center rounded-full text-[var(--text-2)]">
          <X size={16} />
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-[13px] font-medium text-[var(--text-2)]">Job</span>
        <input
          aria-label="Job"
          value={job}
          maxLength={120}
          onChange={(e) => setJob(e.target.value)}
          onBlur={() => job.trim() !== bot.job && patch({ job: job.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="What should it take care of?"
          className="field h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none placeholder:text-[var(--text-3)]"
        />
      </label>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-[var(--text-2)]">Soul</h2>
          {!editingSoul && (
            <button onClick={() => setEditingSoul(true)} className="press hover-surface inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[var(--text-2)]">
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
        {editingSoul ? (
          <div>
            <textarea
              aria-label="Soul"
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              rows={14}
              className="field w-full resize-y rounded-xl bg-[var(--surface-2)] p-3 font-mono text-[12.5px] leading-relaxed outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setEditingSoul(false)} className="press hover-surface rounded-full px-3 py-1.5 text-[13px] text-[var(--text-2)]">
                Cancel
              </button>
              <button
                onClick={async () => {
                  await patch({ soul });
                  setEditingSoul(false);
                }}
                className="press rounded-full px-3.5 py-1.5 text-[13px] font-semibold"
                style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
              >
                Save
              </button>
            </div>
          </div>
        ) : bot.soul.trim() ? (
          <div className="bot-md rounded-2xl bg-[var(--surface)] p-3 text-[13.5px] leading-relaxed edge">
            <Streamdown>{bot.soul}</Streamdown>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-3)]">{bot.name} writes this after getting to know you.</p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-[13px] font-medium text-[var(--text-2)]">Standing instructions</h2>
        {bot.instructions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-3)]">Pin any of your messages to make it a rule {bot.name} always follows.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bot.instructions.map((ins, i) => (
              <li key={`${i}-${ins}`} className="flex items-start gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 text-[13.5px] edge">
                <span className="min-w-0 flex-1 break-words">{ins}</span>
                <button
                  aria-label={`Remove: ${ins}`}
                  onClick={() => patch({ instructions: bot.instructions.filter((_, j) => j !== i) })}
                  className="press grid size-6 shrink-0 place-items-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)]"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReminderList bot={bot} />

      {children}

      <section>
        <ModelPicker label="Model" allowDefault value={bot.model} onChange={(model) => patch({ model })} />
      </section>

      <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)]">
        <FolderOpen size={13} /> Files: ~/.grid/bots/{bot.handle}
      </p>
    </aside>
  );
}
