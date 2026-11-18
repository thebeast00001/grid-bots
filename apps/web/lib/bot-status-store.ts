"use client";

import { useSyncExternalStore } from "react";
import type { Pose } from "./critter/types";

/** Live status per bot (pose + short text), written by the chat and read by the bot list. */
export type BotStatus = { pose: Pose; text: string };

const IDLE: BotStatus = { pose: "idle", text: "" };
const statuses = new Map<string, BotStatus>();
const listeners = new Set<() => void>();

export function setBotStatus(botId: string, s: BotStatus): void {
  const prev = statuses.get(botId);
  if (prev && prev.pose === s.pose && prev.text === s.text) return;
  statuses.set(botId, s);
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBotStatus(botId: string): BotStatus {
  return useSyncExternalStore(
    subscribe,
    () => statuses.get(botId) ?? IDLE,
    () => IDLE,
  );
}
