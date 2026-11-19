import type { UIMessage } from "ai";
import { siteOf, stepsOf, summary } from "@/components/research/sources";

/**
 * What's on a bot's screen right now, worked out from the reply it's writing: the search it's
 * running, the page it's reading, the list it's changing, the words it's writing, or its
 * desktop when it's idle. Drawn, not captured: a real browser comes with the bot's own computer.
 */

export type Screen =
  | { app: "desktop"; last: string | null }
  | { app: "thinking" }
  | { app: "search"; query: string; results: { title: string; site: string; url: string }[]; state: "running" | "done" | "failed"; error?: string }
  | { app: "browser"; url: string; site: string; title?: string; lines: string[]; state: "loading" | "reading" | "failed"; error?: string }
  | { app: "lists"; action: string }
  | { app: "task"; label: string }
  | { app: "writer"; text: string }
  | { app: "routine"; name: string };

type Part = { type: string; state?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; text?: string };

const LINES = 8;
const TAIL = 400;
const TASKS: Record<string, string> = {
  "tool-remember": "Saving a note",
  "tool-react": "Reacting",
  "tool-set_reminder": "Setting a reminder",
  "tool-change_reminder": "Changing a reminder",
  "tool-cancel_reminder": "Cancelling a reminder",
  "tool-list_reminders": "Checking reminders",
  "tool-create_routine": "Setting up a routine",
  "tool-update_routine": "Changing a routine",
  "tool-delete_routine": "Removing a routine",
  "tool-list_routines": "Checking routines",
  "tool-rate_result": "Rating the result",
};

const done = (p: Part) => p.state === "output-available" || p.state === "output-error";

function toolScreen(p: Part): Screen | null {
  const out = (p.output ?? {}) as { ok?: boolean; error?: string; results?: { title: string; site: string; url: string }[]; title?: string; text?: string };
  const failed = done(p) && (p.state === "output-error" || out.ok === false);
  if (p.type === "tool-web_search") {
    const query = String(p.input?.query ?? (p.output as { action?: { query?: string } } | undefined)?.action?.query ?? "");
    if (failed) return { app: "search", query, results: [], state: "failed", error: out.error };
    const results = (out.results ?? []).map((r) => ({ title: r.title, site: r.site, url: r.url }));
    return { app: "search", query, results, state: done(p) ? "done" : "running" };
  }
  if (p.type === "tool-read_page") {
    const url = String(p.input?.url ?? "");
    const base = { app: "browser" as const, url, site: siteOf(url) };
    if (failed) return { ...base, state: "failed", lines: [], error: out.error };
    if (!done(p)) return { ...base, state: "loading", lines: [] };
    const lines = String(out.text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, LINES);
    return { ...base, title: out.title, state: "reading", lines };
  }
  if (p.type === "tool-create_list") return { app: "lists", action: `Making ${String(p.input?.name ?? "a list")}` };
  if (p.type === "tool-change_list") return { app: "lists", action: "Updating a list" };
  if (p.type === "tool-log_expense") return { app: "lists", action: `Logging ${String(p.input?.text ?? "an expense")}` };
  if (p.type === "tool-find_lists" || p.type === "tool-read_list") return { app: "lists", action: "Looking through your lists" };
  if (p.type.startsWith("tool-")) return { app: "task", label: TASKS[p.type] ?? "Working" };
  return null;
}

export function screenOf(parts: UIMessage["parts"], o: { streaming: boolean; run?: string | null }): Screen {
  if (o.run) return { app: "routine", name: o.run };
  const list = parts as unknown as Part[];
  if (!o.streaming) {
    const steps = stepsOf(parts);
    return { app: "desktop", last: steps.length ? summary(steps) : null };
  }
  // The newest thing it's doing: the last tool step, or the words it's writing after it.
  for (let i = list.length - 1; i >= 0; i--) {
    const part = list[i];
    if (part.type === "text" && part.text?.trim()) {
      const t = part.text.trim();
      return { app: "writer", text: t.length > TAIL ? t.slice(t.length - TAIL) : t };
    }
    const s = toolScreen(part);
    if (s) return s;
  }
  return { app: "thinking" };
}
