import { EventEmitter } from "node:events";

/**
 * Things the open app should hear about without asking: a bot wrote a message on its
 * own (a reminder, later a routine), or a bot's reminders changed. One bus per server
 * process, kept on globalThis so every route bundle and the scheduler share it.
 */
export type GridEvent =
  | { type: "message"; botId: string; messageId: string; title?: string; body?: string }
  | { type: "reminders"; botId: string };

const g = globalThis as unknown as { __gridBus?: EventEmitter };
const bus = () => {
  if (!g.__gridBus) {
    g.__gridBus = new EventEmitter();
    g.__gridBus.setMaxListeners(0);
  }
  return g.__gridBus;
};

export function publish(e: GridEvent): void {
  bus().emit("event", e);
}

/** Calls `fn` for every event until the returned function is called. */
export function subscribe(fn: (e: GridEvent) => void): () => void {
  bus().on("event", fn);
  return () => bus().off("event", fn);
}
