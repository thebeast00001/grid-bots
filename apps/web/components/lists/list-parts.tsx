"use client";

import { Check, CheckSquare, Flame, Receipt } from "lucide-react";
import { DateTime } from "luxon";
import type { ItemView, ListKind, ListView } from "@/lib/client-types";
import { formatAmount } from "@/lib/lists/format";

/** Small pieces shared by the chat card, the list page and the overview. */

export const KIND_LABEL: Record<ListKind, string> = { checklist: "Checklist", habits: "Habits", expenses: "Expenses" };

export function KindIcon({ kind, size = 15 }: { kind: ListKind; size?: number }) {
  if (kind === "habits") return <Flame size={size} aria-hidden />;
  if (kind === "expenses") return <Receipt size={size} aria-hidden />;
  return <CheckSquare size={size} aria-hidden />;
}

/** "1 of 4 done" · "2 of 3 today" · "₹1,240.00 this month" */
export function summaryOf(v: ListView, locale?: string): string {
  const all = v.open + v.done;
  if (v.kind === "checklist") return all ? `${v.done} of ${all} done` : "Empty";
  if (v.kind === "habits") return all ? `${v.done} of ${all} today` : "No habits yet";
  return `${formatAmount(v.month ?? 0, v.currency, locale)} this month`;
}

/** A round tick box. */
export function Tick({ on, label, onToggle, size = 22 }: { on: boolean; label: string; onToggle: () => void; size?: number }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="press grid shrink-0 place-items-center rounded-full transition-colors duration-150"
      style={{ width: size, height: size, background: on ? "var(--bot)" : "transparent", color: on ? "var(--bot-ink)" : "transparent", boxShadow: on ? undefined : "inset 0 0 0 1.5px var(--edge-strong)" }}
    >
      <Check size={size * 0.6} strokeWidth={3} aria-hidden />
    </button>
  );
}

export const today = (v: ListView) => v.days?.at(-1) ?? DateTime.now().toISODate()!;

export function dayLabel(day: string, todayIso: string): string {
  if (day === todayIso) return "today";
  return DateTime.fromISO(day).toFormat("ccc d LLL");
}

export function streakText(i: ItemView): string {
  return i.streak ? `${i.streak}-day streak` : "No streak yet";
}
