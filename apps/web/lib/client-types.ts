/** Shapes the browser receives from Grid's API (no secrets). */
import type { ProviderKind } from "./models/kinds";
import type { Repeat } from "./reminders/when";

export type { ModelRef } from "./models/types";

export type ProviderView = { id: string; kind: ProviderKind; label: string; baseUrl: string | null; hint: string | null };

export type KindView = {
  kind: ProviderKind;
  label: string;
  auth: "key" | "optional-key" | "none" | "oauth";
  baseUrl?: string;
  keyUrl?: string;
  local?: boolean;
  note?: string;
};

export type ModelInfo = { id: string; name: string; tools: boolean | null; vision: boolean | null };

export type BotView = {
  id: string;
  name: string;
  handle: string;
  job: string;
  avatar: import("./critter/types").CritterConfig;
  soul: string;
  interview: "pending" | "done" | "skipped";
  model: import("./models/types").ModelRef | null;
  instructions: string[];
  /** Notifications held until then (year 9999 = until turned back on); null = not muted. */
  mutedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  preview?: string | null;
};

export type ApiErrorBody = { error?: { code: string; message: string; action?: { label: string; href: string } } };

export type NotificationView = {
  id: string;
  botId: string;
  kind: "reminder" | "routine" | "routine-failed";
  /** The bot's name. */
  title: string;
  body: string;
  messageId: string | null;
  importance: "high" | "normal" | "low";
  /** Whether it pinged you; if not, why it waited in the inbox. */
  ping: boolean;
  reason: "muted" | "quiet-hours" | "not-important" | null;
  createdAt: string;
  readAt: string | null;
};

export type RoutineView = {
  id: string;
  botId: string;
  name: string;
  instruction: string;
  repeat: Repeat;
  status: "active" | "paused" | "done";
  nextRunAt: string | null;
  lastRunAt: string | null;
  /** "Weekdays at 8:00 AM", "Once, Tomorrow, 9:00 AM". */
  scheduleLabel: string;
  running: boolean;
};

export type RunView = {
  id: string;
  routineId: string;
  trigger: "schedule" | "manual";
  status: "running" | "done" | "failed" | "missed";
  startedAt: string;
  finishedAt: string | null;
  messageId: string | null;
  error: string | null;
  late: boolean;
};

export type ReminderStatus = "scheduled" | "fired" | "done" | "cancelled";

export type ReminderView = {
  id: string;
  botId: string;
  text: string;
  /** The next (or last, once fired) time it goes off, ISO. */
  dueAt: string;
  repeat: Repeat;
  status: ReminderStatus;
  late: boolean;
  firedAt: string | null;
};

export type ListKind = "checklist" | "habits" | "expenses";

export type ItemView = {
  id: string;
  text: string;
  done: boolean;
  doneAt: string | null;
  position: number;
  /** Expenses: hundredths of the list's currency. */
  amount: number | null;
  /** Expenses: YYYY-MM-DD. */
  spentOn: string | null;
  /** Habits: the checked days among the list's `days`. */
  checkins?: string[];
  /** Habits: consecutive days up to today (or yesterday, if today isn't checked yet). */
  streak?: number;
};

export type ListView = {
  id: string;
  name: string;
  kind: ListKind;
  botId: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  items: ItemView[];
  /** Checklist: not done. Habits: not checked in today. Expenses: entries. */
  open: number;
  /** Checklist: done. Habits: checked in today. */
  done: number;
  /** Expenses, in hundredths: all time and this calendar month. */
  total?: number;
  month?: number;
  /** Habits: the last 7 days, oldest first, ending today. */
  days?: string[];
};
