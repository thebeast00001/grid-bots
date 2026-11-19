"use client";

import { useMemo, useState } from "react";
import { REPEATS, formatWhen, parseRepeat, parseWhen, repeatLabel, type Repeat } from "@/lib/reminders/when";
import { browserZone } from "./reminders-store";

const REPEAT_NAMES: Record<Repeat, string> = {
  none: "Doesn't repeat",
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

export type ReminderInput = { text: string; when: string; repeat: Repeat };

/**
 * What + when (in plain words) + repeat, with a live preview of exactly when it will go
 * off. `when` may be left empty when changing a reminder (keeps its time).
 */
export function ReminderForm({
  initial,
  whenHint,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ReminderInput;
  /** Shown in the empty When field when it's optional (the current time). */
  whenHint?: string;
  submitLabel: string;
  onSubmit: (v: ReminderInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [when, setWhen] = useState(initial.when);
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [saving, setSaving] = useState(false);
  const optionalWhen = whenHint !== undefined;

  const parsed = useMemo(() => (when.trim() ? parseWhen(when, { now: new Date(), zone: browserZone() }) : null), [when]);
  const preview = !parsed
    ? null
    : "error" in parsed
      ? parsed.error === "past"
        ? "That time has already passed."
        : "I couldn't tell when that is. Try “Friday 6pm” or “in 2 hours”."
      : [formatWhen(parsed.at, { now: new Date(), zone: browserZone() }), repeatLabel(repeat, parsed.at, browserZone())].filter(Boolean).join(" · ");
  const bad = parsed !== null && "error" in parsed;
  const ready = text.trim().length > 0 && !bad && (optionalWhen || parsed !== null) && !saving;

  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await onSubmit({ text: text.trim(), when: when.trim(), repeat });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-[var(--surface)] p-2.5 edge"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <input
        aria-label="What"
        autoFocus
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pay rent"
        className="field h-9 rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none placeholder:text-[var(--text-3)]"
      />
      <input
        aria-label="When"
        value={when}
        maxLength={200}
        onChange={(e) => {
          setWhen(e.target.value);
          const r = parseRepeat(e.target.value);
          if (r) setRepeat(r);
        }}
        placeholder={whenHint ?? "Friday 6pm, in 2 hours, every day at 9am"}
        className="field h-9 rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none placeholder:text-[var(--text-3)]"
      />
      {preview && (
        <p data-testid="when-preview" aria-live="polite" className={`px-1 text-[12.5px] ${bad ? "text-[var(--danger)]" : "text-[var(--text-2)]"}`}>
          {preview}
        </p>
      )}
      <div className="flex items-center gap-2">
        <select
          aria-label="Repeats"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as Repeat)}
          className="field h-8 min-w-0 flex-1 rounded-lg bg-[var(--surface-2)] px-2 text-[12.5px] outline-none"
        >
          {REPEATS.map((r) => (
            <option key={r} value={r}>
              {REPEAT_NAMES[r]}
            </option>
          ))}
        </select>
        <button type="button" onClick={onCancel} className="press hover-surface rounded-full px-3 py-1.5 text-[13px] text-[var(--text-2)]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="press rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: "var(--bot)", color: "var(--bot-ink)" }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
