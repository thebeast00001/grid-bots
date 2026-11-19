"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, BellRing, Check, ChevronDown, Pencil, Repeat2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ReminderView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";
import { SNOOZE_PRESETS, formatWhen, repeatLabel, type SnoozePreset } from "@/lib/reminders/when";
import { ReminderForm } from "./reminder-form";
import { browserZone, refreshReminders, relative, useNow, useReminders } from "./reminders-store";

const when = (iso: string, now: Date) => formatWhen(new Date(iso), { now, zone: browserZone() });

function Shell({ testId, muted, children }: { testId: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="mt-1.5 w-[min(340px,78vw)] rounded-[20px] p-3 edge"
      style={{ background: muted ? "var(--surface)" : "var(--bot-soft)", opacity: muted ? 0.85 : 1 }}
    >
      {children}
    </div>
  );
}

function Icon({ ringing = false }: { ringing?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="grid size-8 shrink-0 place-items-center rounded-full"
      style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
      initial={false}
      animate={ringing && !reduce ? { rotate: [0, -14, 12, -8, 5, 0] } : { rotate: 0 }}
      transition={{ duration: 0.7, ease: ease.out }}
    >
      {ringing ? <BellRing size={15} /> : <Bell size={15} />}
    </motion.span>
  );
}

/** Asks once for system notifications, right where it's useful. */
function NotifyAsk() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);
  if (perm !== "default") return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
      <span className="min-w-0 flex-1">Get a notification then?</span>
      <button
        onClick={async () => setPerm(await Notification.requestPermission())}
        className="press rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] font-semibold edge"
      >
        Allow
      </button>
    </div>
  );
}

/** "Reminder set" under the bot's reply: the exact time, with Change and Cancel while it's upcoming. */
export function ReminderSetCard({ botId, reminder }: { botId: string; reminder: ReminderView }) {
  const list = useReminders(botId);
  const r = list?.find((x) => x.id === reminder.id) ?? reminder;
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const zone = browserZone();

  const cancel = async () => {
    try {
      await api(`/api/reminders/${r.id}`, { method: "DELETE" });
      await refreshReminders(botId);
    } catch {
      toast("Couldn't cancel that reminder.");
    }
  };

  if (editing) {
    return (
      <div className="mt-1.5 w-[min(340px,78vw)]">
        <ReminderForm
          initial={{ text: r.text, when: "", repeat: r.repeat }}
          whenHint={when(r.dueAt, now)}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            try {
              await api(`/api/reminders/${r.id}`, { method: "PATCH", body: JSON.stringify({ text: v.text, when: v.when || undefined, repeat: v.repeat }) });
              await refreshReminders(botId);
              setEditing(false);
            } catch (e) {
              toast(e instanceof Error ? e.message : "Couldn't change that reminder.");
            }
          }}
        />
      </div>
    );
  }

  const upcoming = r.status === "scheduled";
  const cancelled = r.status === "cancelled";
  const repeats = repeatLabel(r.repeat, new Date(r.dueAt), zone);
  return (
    <Shell testId="reminder-set" muted={!upcoming}>
      <div className="flex items-start gap-2.5">
        <Icon />
        <div className="min-w-0 flex-1">
          <div className={`break-words text-[14.5px] font-semibold leading-snug ${cancelled ? "line-through decoration-[var(--text-3)]" : ""}`}>{r.text}</div>
          <div className="tnum mt-0.5 text-[12.5px] text-[var(--text-2)]">
            {cancelled ? "Cancelled" : upcoming ? `${when(r.dueAt, now)} · ${relative(new Date(r.dueAt), now)}` : `Went off ${when(r.firedAt ?? r.dueAt, now)}`}
          </div>
          {repeats && !cancelled && (
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--text-3)]">
              <Repeat2 size={12} /> {repeats}
            </div>
          )}
        </div>
      </div>
      {upcoming && (
        <>
          <div className="mt-2.5 flex gap-1.5">
            <button onClick={() => setEditing(true)} className="press inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12.5px] font-medium edge">
              <Pencil size={12} /> Change
            </button>
            <button onClick={cancel} className="press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] text-[var(--text-2)] hover:bg-[var(--surface)]">
              <X size={12} /> Cancel
            </button>
          </div>
          <NotifyAsk />
        </>
      )}
    </Shell>
  );
}

/** A short line for change_reminder / cancel_reminder results. */
export function ReminderChip({ kind, reminder }: { kind: "changed" | "cancelled"; reminder: ReminderView }) {
  const now = useNow();
  return (
    <div data-testid="reminder-chip" className="mt-1.5 inline-flex max-w-[min(340px,78vw)] items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-2)] edge">
      {kind === "cancelled" ? <X size={12} /> : <Bell size={12} />}
      <span className="truncate">
        {kind === "cancelled" ? `Cancelled: ${reminder.text}` : `${reminder.text} · ${when(reminder.dueAt, now)}`}
      </span>
    </div>
  );
}

/** While the bot is still deciding the reminder. */
export function ReminderPending() {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-3)] edge">
      <Bell size={12} /> Setting a reminder…
    </div>
  );
}

export type Occurrence = { state: "done"; at: string } | { state: "snoozed"; until: string };
export type DueData = { reminderId: string; text: string; dueAt: string; late: boolean };

/** A reminder going off: Done, or Snooze for a while. What you chose is kept on the message. */
export function ReminderDueCard({ botId, messageId, data, occurrence, fresh }: { botId: string; messageId: string; data: DueData; occurrence?: Occurrence; fresh: boolean }) {
  const [state, setState] = useState<Occurrence | undefined>(occurrence);
  const [menu, setMenu] = useState(false);
  const now = useNow();
  useEffect(() => setState(occurrence), [occurrence]);

  const act = async (body: Record<string, unknown>) => {
    setMenu(false);
    try {
      const r = await api<ReminderView>(`/api/reminders/${data.reminderId}`, { method: "PATCH", body: JSON.stringify({ ...body, messageId }) });
      setState(body.action === "done" ? { state: "done", at: new Date().toISOString() } : { state: "snoozed", until: r.dueAt });
      await refreshReminders(botId);
    } catch {
      toast("That reminder no longer exists.");
    }
  };

  return (
    <Shell testId="reminder-due" muted={state?.state === "done"}>
      <div className="flex items-start gap-2.5">
        <Icon ringing={fresh && !state} />
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold leading-snug">{data.text}</div>
          <div className="tnum mt-0.5 text-[12.5px] text-[var(--text-2)]">
            {data.late ? `Late · was due ${when(data.dueAt, now)} (Grid wasn't running)` : `Due ${when(data.dueAt, now)}`}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {state?.state === "done" ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-2)]">
            <Check size={13} /> Done · {when(state.at, now)}
          </span>
        ) : (
          <>
            {state?.state === "snoozed" && <span className="tnum mr-auto text-[12.5px] text-[var(--text-2)]">Snoozed until {when(state.until, now)}</span>}
            <button
              onClick={() => act({ action: "done" })}
              className="press inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold"
              style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
            >
              <Check size={13} /> Done
            </button>
            <SnoozeMenu open={menu} onOpenChange={setMenu} onPick={(preset) => act({ action: "snooze", preset })} />
          </>
        )}
      </div>
    </Shell>
  );
}

function SnoozeMenu({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (p: SnoozePreset) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) onOpenChange(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={box} className="relative">
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="press inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1 text-[12.5px] font-medium edge"
      >
        Snooze <ChevronDown size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={spring.snappy}
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-full left-0 z-20 mb-1.5 flex w-44 flex-col rounded-2xl bg-[var(--surface)] p-1 edge"
          >
            {SNOOZE_PRESETS.map((p) => (
              <button key={p.id} role="menuitem" onClick={() => onPick(p.id)} className="press rounded-xl px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-2)]">
                {p.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
