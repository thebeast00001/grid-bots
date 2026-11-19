"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { History, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { browserZone, useNow } from "@/components/reminders/reminders-store";
import { api } from "@/lib/api-client";
import type { BotView, RoutineView, RunView } from "@/lib/client-types";
import { spring } from "@/lib/motion";
import { formatWhen } from "@/lib/reminders/when";
import { routineStatus } from "./routine-card";
import { RoutineForm, type RoutineInput } from "./routine-form";
import { PRESETS, refreshRoutines, runNow, useRoutines } from "./routines-store";

const icon = "press grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)]";

/** The profile's Routines section: standing jobs this bot does on its own. */
export function RoutineList({ bot }: { bot: BotView }) {
  const list = useRoutines(bot.id);
  const [draft, setDraft] = useState<RoutineInput | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const call = async (path: string, init: RequestInit, failure: string) => {
    try {
      await api(path, init);
      await refreshRoutines(bot.id);
      return true;
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : failure);
      return false;
    }
  };

  return (
    <section aria-label="Routines">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-[var(--text-2)]">Routines</h2>
        {!draft && (
          <button onClick={() => setDraft({ name: "", instruction: "", when: "" })} aria-label="Add a routine" className="press hover-surface inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-[var(--text-2)]">
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {draft ? (
        <div className="mb-2">
          <RoutineForm
            key={draft.name}
            initial={draft}
            submitLabel="Add"
            onCancel={() => setDraft(null)}
            onSubmit={async (v) => {
              if (await call("/api/routines", { method: "POST", body: JSON.stringify({ botId: bot.id, ...v }) }, "Couldn't add that routine.")) setDraft(null);
            }}
          />
        </div>
      ) : (
        list !== null &&
        list.length < 50 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.filter((p) => !list.some((r) => r.name === p.name)).map((p) => (
              <button key={p.name} onClick={() => setDraft({ ...p })} className="press inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--text-2)] edge">
                <Plus size={11} /> {p.name}
              </button>
            ))}
          </div>
        )
      )}

      {list !== null && list.length === 0 && !draft && (
        <p className="text-[13px] text-[var(--text-3)]">No routines yet. Pick one above, or ask {bot.name}: “every weekday at 8, give me a briefing”.</p>
      )}

      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {(list ?? []).map((r) => (
            <motion.li key={r.id} layout data-testid="routine-row" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring.snappy}>
              {editing === r.id ? (
                <RoutineForm
                  initial={{ name: r.name, instruction: r.instruction, when: "" }}
                  keepRepeat={r.repeat}
                  whenHint={r.scheduleLabel}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (v) => {
                    const body = { name: v.name, instruction: v.instruction, when: v.when || undefined };
                    if (await call(`/api/routines/${r.id}`, { method: "PATCH", body: JSON.stringify(body) }, "Couldn't change that routine.")) setEditing(null);
                  }}
                />
              ) : (
                <Row bot={bot} r={r} onEdit={() => setEditing(r.id)} call={call} />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function Row({ bot, r, onEdit, call }: { bot: BotView; r: RoutineView; onEdit: () => void; call: (p: string, i: RequestInit, f: string) => Promise<boolean> }) {
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const on = r.status === "active";

  const toggleHistory = async () => {
    if (runs) return setRuns(null);
    try {
      setRuns((await api<{ runs: RunView[] }>(`/api/routines/${r.id}/runs`)).runs);
    } catch {
      toast("Couldn't load the history.");
    }
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] px-3 py-2 edge">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="break-words text-[13.5px] font-medium">{r.name}</div>
          <div className="text-[12px] text-[var(--text-2)]">{r.scheduleLabel}</div>
          <div className="tnum text-[11.5px] text-[var(--text-3)]">{routineStatus(r, now)}</div>
        </div>
        {r.status !== "done" && (
          <button
            role="switch"
            aria-checked={on}
            aria-label={`${r.name} is on`}
            onClick={() => call(`/api/routines/${r.id}`, { method: "PATCH", body: JSON.stringify({ paused: on }) }, "Couldn't change that routine.")}
            className="press relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors"
            style={{ background: on ? "var(--bot)" : "var(--surface-3)" }}
          >
            <motion.span layout transition={spring.snappy} className="absolute top-0.5 size-4 rounded-full bg-white" style={{ left: on ? 18 : 2 }} />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-0.5">
        <button
          aria-label="Run now"
          title="Run now"
          disabled={r.running}
          onClick={async () => {
            const err = await runNow(r.id, bot.id);
            if (err) toast(err);
          }}
          className={`${icon} disabled:opacity-50`}
        >
          {r.running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </button>
        <button aria-label="Change routine" title="Change" onClick={onEdit} className={icon}>
          <Pencil size={13} />
        </button>
        <button aria-label="History" title="History" aria-expanded={!!runs} onClick={toggleHistory} className={icon}>
          <History size={13} />
        </button>
        <span className="flex-1" />
        {confirming ? (
          <span className="flex items-center gap-1 text-[12px]">
            <button onClick={() => setConfirming(false)} className="press rounded-full px-2 py-0.5 text-[var(--text-2)] hover:bg-[var(--surface-2)]">
              Keep
            </button>
            <button
              onClick={() => call(`/api/routines/${r.id}`, { method: "DELETE" }, "Couldn't delete that routine.")}
              className="press rounded-full px-2 py-0.5 font-semibold text-[var(--danger)] hover:bg-[var(--surface-2)]"
            >
              Yes, delete
            </button>
          </span>
        ) : (
          <button aria-label="Delete routine" title="Delete" onClick={() => setConfirming(true)} className={icon}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {runs && (
        <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-[var(--edge)] pt-1.5">
          {runs.length === 0 && <li className="text-[12px] text-[var(--text-3)]">Hasn&apos;t run yet.</li>}
          {runs.map((x) => (
            <li key={x.id} data-testid="run" className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-[var(--text-2)]">
              <span className="tnum">{formatWhen(new Date(x.startedAt), { now, zone: browserZone() })}</span>
              <span className="text-[var(--text-3)]">{x.trigger === "manual" ? "Ran by hand" : "On schedule"}</span>
              <span className={x.status === "failed" || x.status === "missed" ? "text-[var(--danger)]" : ""}>
                · {x.status === "done" ? "Done" : x.status === "running" ? "Running…" : x.status === "missed" ? "Missed" : "Failed"}
                {x.late ? " (late)" : ""}
              </span>
              {x.error && <span className="w-full break-words text-[11.5px] text-[var(--text-3)]">{x.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
