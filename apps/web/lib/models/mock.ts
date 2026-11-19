import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * A deterministic model for automated tests (GRID_E2E=1 or Vitest only).
 * Precedence: interview marker → soul marker → "remember" → echo.
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
