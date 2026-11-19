import { EventEmitter } from "node:events";
import type { NotificationView } from "./client-types";

/**
 * Things the open app should hear about without asking: a bot wrote a message on its
 * own (a reminder, later a routine), or a bot's reminders changed. One bus per server
 * process, kept on globalThis so every route bundle and the scheduler share it.
 */
export type GridEvent =
  | { type: "message"; botId: string; messageId: string; title?: string; body?: string }
  | { type: "reminders"; botId: string }
  | { type: "routines"; botId: string }
  | { type: "notification"; notification: NotificationView }
  /** Notifications were marked read (another tab should refresh its counts). */
  | { type: "inbox" }
  | { type: "run"; botId: string; routineId: string; runId: string; name: string; status: "running" | "done" | "failed" };

const g = globalThis as unknown as { __gridBus?: EventEmitter };
const bus = () => {
  if (!g.__gridBus) {
    g.__gridBus = new EventEmitter();
    g.__gridBus.setMaxListeners(0);
  }
  return g.__gridBus;
};

const streams = globalThis as unknown as { __gridStreams?: number };
/** How many apps are listening right now (open event streams); 0 means nobody would see a toast. */
export const openStreams = () => streams.__gridStreams ?? 0;
export const streamOpened = () => {
  streams.__gridStreams = openStreams() + 1;
};
export const streamClosed = () => {
  streams.__gridStreams = Math.max(0, openStreams() - 1);
};

export function publish(e: GridEvent): void {
  bus().emit("event", e);
}

/** Calls `fn` for every event until the returned function is called. */
export function subscribe(fn: (e: GridEvent) => void): () => void {
  bus().on("event", fn);
  return () => bus().off("event", fn);
}
