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
  createdAt: string;
  updatedAt: string;
  preview?: string | null;
};

export type ApiErrorBody = { error?: { code: string; message: string; action?: { label: string; href: string } } };

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
