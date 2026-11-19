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

const TOOL_LABELS: Record<string, string> = { "tool-remember": "Remembering…", "tool-react": "Reacting…", "tool-web_search": "Searching the web…" };
const pending = (part: UIMessage["parts"][number]) => "state" in part && part.state !== "output-available" && part.state !== "output-error";

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
    const parts = p.last?.role === "assistant" ? p.last.parts : [];
    const reading = parts.filter((part) => part.type === "tool-read_page" && pending(part)).length;
    if (reading) return { pose: "working", text: reading === 1 ? "Reading a page…" : `Reading ${reading} pages…` };
    const running = parts.find((part) => part.type in TOOL_LABELS && pending(part));
    if (running) return { pose: "working", text: TOOL_LABELS[running.type] };
    return { pose: "talking", text: "" };
  }
  if (p.justFinished) return { pose: "happy", text: "" };
  return { pose: "idle", text: "" };
}
