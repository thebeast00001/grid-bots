import type { UIMessage } from "ai";
import type { BotStatus } from "@/lib/bot-status-store";

export type ChatError = { code: string; message: string; action?: { label: string; href: string } };

/** Errors reach the client as JSON text, either `{error:{...}}` (HTTP) or `{code,...}` (mid-stream). */
export function parseChatError(e: unknown): ChatError {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const parsed = JSON.parse(raw) as { error?: ChatError } & Partial<ChatError>;
    const err = parsed.error ?? parsed;
    if (err && typeof err.code === "string" && typeof err.message === "string") {
      return err.action ? { code: err.code, message: err.message, action: err.action } : { code: err.code, message: err.message };
    }
  } catch {
    // Not JSON.
  }
  return { code: "unknown", message: raw };
}

const TOOL_LABELS: Record<string, string> = { "tool-remember": "Remembering…", "tool-react": "Reacting…" };

/** What the bot's face and status line should show for the chat's current state. */
export function deriveStatus(p: {
  chat: "submitted" | "streaming" | "ready" | "error";
  last?: UIMessage;
  error?: ChatError | null;
  justFinished: boolean;
}): BotStatus {
  if (p.chat === "error") return { pose: "stuck", text: p.error?.message ?? "Something went wrong." };
  if (p.chat === "submitted") return { pose: "thinking", text: "Thinking…" };
  if (p.chat === "streaming") {
    const running = p.last?.role === "assistant" ? p.last.parts.find((part) => part.type in TOOL_LABELS && "state" in part && part.state !== "output-available" && part.state !== "output-error") : undefined;
    if (running) return { pose: "working", text: TOOL_LABELS[running.type] };
    return { pose: "talking", text: "" };
  }
  if (p.justFinished) return { pose: "happy", text: "" };
  return { pose: "idle", text: "" };
}
