"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Pause, Play, Pencil, Repeat2, X } from "lucide-react";
import { toast } from "sonner";
import { browserZone, useNow } from "@/components/reminders/reminders-store";
import { api } from "@/lib/api-client";
import type { RoutineView } from "@/lib/client-types";
import { formatWhen } from "@/lib/reminders/when";
import { RoutineForm } from "./routine-form";
import { refreshRoutines, runNow, useRoutines } from "./routines-store";

const when = (iso: string, now: Date) => formatWhen(new Date(iso), { now, zone: browserZone() });

/** One line about where a routine stands: next run, paused, running, finished. */
export function routineStatus(r: RoutineView, now: Date): string {
  if (r.running) return "Running now…";
  if (r.status === "paused") return "Paused";
  if (r.status === "done" || !r.nextRunAt) return r.lastRunAt ? `Ran ${when(r.lastRunAt, now)}` : "Finished";
  return `Next ${when(r.nextRunAt, now)}`;
}

const pill = "press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium";

/** "Routine set" under the bot's reply: schedule, next run, and Run now / Pause / Change. */
export function RoutineSetCard({ botId, routine }: { botId: string; routine: RoutineView }) {
  const list = useRoutines(botId);
  const live = list?.find((x) => x.id === routine.id);
  const r = live ?? routine;
  const gone = list !== null && !live;
  const now = useNow();
  const [editing, setEditing] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    try {
      await api(`/api/routines/${r.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await refreshRoutines(botId);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change that routine.");
      return false;
    }
  };

  if (editing && !gone) {
    return (
      <div className="mt-1.5 w-[min(360px,80vw)]">
        <RoutineForm
          initial={{ name: r.name, instruction: r.instruction, when: "" }}
          keepRepeat={r.repeat}
          whenHint={r.scheduleLabel}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            if (await patch({ name: v.name, instruction: v.instruction, when: v.when || undefined })) setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="routine-set"
      className="mt-1.5 w-[min(360px,80vw)] rounded-[20px] p-3 edge"
      style={{ background: gone ? "var(--surface)" : "var(--bot-soft)", opacity: gone ? 0.85 : 1 }}
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
          <Repeat2 size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`break-words text-[14.5px] font-semibold leading-snug ${gone ? "line-through decoration-[var(--text-3)]" : ""}`}>{r.name}</div>
          <div className="line-clamp-2 break-words text-[12.5px] text-[var(--text-2)]">{r.instruction}</div>
          <div className="mt-1 text-[12.5px] text-[var(--text-2)]">{r.scheduleLabel}</div>
          <div className="tnum text-[12px] text-[var(--text-3)]">{gone ? "Deleted" : routineStatus(r, now)}</div>
        </div>
      </div>
      {!gone && r.status !== "done" && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            disabled={r.running}
            onClick={async () => {
              const err = await runNow(r.id, botId);
              if (err) toast(err);
            }}
            className={`${pill} disabled:opacity-50`}
            style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
          >
            {r.running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run now
          </button>
          <button onClick={() => patch({ paused: r.status !== "paused" })} className={`${pill} bg-[var(--surface)] edge`}>
            {r.status === "paused" ? <Play size={12} /> : <Pause size={12} />} {r.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={() => setEditing(true)} className={`${pill} text-[var(--text-2)] hover:bg-[var(--surface)]`}>
            <Pencil size={12} /> Change
          </button>
        </div>
      )}
    </div>
  );
}

export type RoutineData = {
  routineId: string;
  runId: string;
  name: string;
  status: "done" | "failed";
  error?: string;
  action?: { label: string; href: string };
  late: boolean;
  at?: string;
};

/** Above a routine's result: which routine wrote it and when; or, if it failed, why. */
export function RoutineHeader({ botId, data }: { botId: string; data: RoutineData }) {
  const now = useNow();
  if (data.status === "failed") {
    return (
      <div data-testid="routine-result" className="w-[min(360px,80vw)] rounded-[20px] bg-[var(--surface)] p-3 edge">
        <div className="flex items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--danger)]">
            <AlertTriangle size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-[14.5px] font-semibold leading-snug">
              {data.name} couldn&apos;t run
            </div>
            <div className="break-words text-[12.5px] text-[var(--text-2)]">{data.error}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.action &&
            (data.action.href.startsWith("http") ? (
              <a href={data.action.href} target="_blank" rel="noreferrer" className={`${pill} bg-[var(--text)] text-[var(--bg)]`}>
                {data.action.label}
              </a>
            ) : (
              <Link href={data.action.href} className={`${pill} bg-[var(--text)] text-[var(--bg)]`}>
                {data.action.label}
              </Link>
            ))}
          <button
            onClick={async () => {
              const err = await runNow(data.routineId, botId);
              if (err) toast(err);
            }}
            className={`${pill} bg-[var(--surface-2)]`}
          >
            <Play size={12} /> Try again
          </button>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="routine-result" className="mb-1 flex items-center gap-1.5 pl-1 text-[12px] text-[var(--text-2)]">
      <Repeat2 size={12} style={{ color: "var(--bot-strong)" }} />
      <span className="font-semibold text-[var(--text)]">{data.name}</span>
      <span className="text-[var(--text-3)]">· Routine{data.at ? ` · ${when(data.at, now)}` : ""}</span>
      {data.late && <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10.5px] font-medium">Late</span>}
    </div>
  );
}

/** One line for update_routine / delete_routine results. */
export function RoutineChip({ kind, routine }: { kind: "updated" | "deleted"; routine?: RoutineView }) {
  return (
    <div data-testid="routine-chip" className="mt-1.5 inline-flex max-w-[min(360px,80vw)] items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-2)] edge">
      {kind === "deleted" ? <X size={12} /> : <Repeat2 size={12} />}
      <span className="truncate">{kind === "deleted" ? "Deleted a routine" : `${routine?.name} · ${routine?.status === "paused" ? "Paused" : routine?.scheduleLabel}`}</span>
    </div>
  );
}

export function RoutinePending() {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-3)] edge">
      <Repeat2 size={12} /> Setting up a routine…
    </div>
  );
}
