"use client";

import { useMemo, useState } from "react";
import { browserZone } from "@/components/reminders/reminders-store";
import { formatWhen, parseRepeat, parseWhen, repeatLabel, type Repeat } from "@/lib/reminders/when";

export type RoutineInput = { name: string; instruction: string; when: string };

/**
 * Name, what to do, and when (plain words), with a live preview of the schedule and the
 * next run. When changing a routine, `when` may stay empty to keep its schedule.
 */
export function RoutineForm({
  initial,
  keepRepeat,
  whenHint,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: RoutineInput;
  /** The routine's current repeat, kept when the new words don't name one. */
  keepRepeat?: Repeat;
  /** Placeholder for an optional When (the current schedule). */
  whenHint?: string;
  submitLabel: string;
  onSubmit: (v: RoutineInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [instruction, setInstruction] = useState(initial.instruction);
  const [when, setWhen] = useState(initial.when);
  const [saving, setSaving] = useState(false);
  const optionalWhen = whenHint !== undefined;

  const preview = useMemo(() => {
    if (!when.trim()) return null;
    const zone = browserZone();
    const now = new Date();
    const p = parseWhen(when, { now, zone });
    if ("error" in p) return { bad: true, text: p.error === "past" ? "That time has already passed." : "I couldn't tell when that is. Try “every weekday at 8am”." };
    const repeat = parseRepeat(when) ?? keepRepeat ?? "none";
    const next = formatWhen(p.at, { now, zone });
    return { bad: false, text: repeat === "none" ? `Once, ${next}` : `${repeatLabel(repeat, p.at, zone)} · next ${next}` };
  }, [when, keepRepeat]);

  const ready = name.trim() && instruction.trim() && (optionalWhen || when.trim()) && !preview?.bad && !saving;
  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), instruction: instruction.trim(), when: when.trim() });
    } finally {
      setSaving(false);
    }
  };
  const input = "field rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none placeholder:text-[var(--text-3)]";

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-[var(--surface)] p-2.5 edge"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <input aria-label="Name" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Morning briefing" className={`${input} h-9`} />
      <textarea
        aria-label="What to do"
        value={instruction}
        maxLength={2000}
        rows={3}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Give me a short briefing for the day…"
        className={`${input} resize-y py-2 leading-snug`}
      />
      <input aria-label="When" value={when} maxLength={200} onChange={(e) => setWhen(e.target.value)} placeholder={whenHint ?? "every weekday at 8am"} className={`${input} h-9`} />
      {preview && (
        <p data-testid="schedule-preview" aria-live="polite" className={`px-1 text-[12.5px] ${preview.bad ? "text-[var(--danger)]" : "text-[var(--text-2)]"}`}>
          {preview.text}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="press hover-surface rounded-full px-3 py-1.5 text-[13px] text-[var(--text-2)]">
          Cancel
        </button>
        <button type="submit" disabled={!ready} className="press rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-40" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
