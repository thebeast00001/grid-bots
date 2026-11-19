import { simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { Bot } from "./repo";
import { SOUL_HEADINGS, defaultSoul, interviewProgress, writeSoul } from "./soul";

const bot: Bot = {
  id: "b1",
  name: "Maya",
  handle: "maya",
  job: "Runs my week",
  avatar: { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" },
  soul: "",
  interview: "pending",
  model: null,
  instructions: [],
  createdAt: "",
  updatedAt: "",
};
const u = (text: string): UIMessage => ({ id: text, role: "user", parts: [{ type: "text", text }] });
const a = (text: string): UIMessage => ({ id: `a-${text}`, role: "assistant", parts: [{ type: "text", text }] });

test("defaultSoul has all six headings and puts risky actions under Always ask first", () => {
  const soul = defaultSoul(bot);
  for (const h of SOUL_HEADINGS) expect(soul).toContain(h.replace("{name}", "Maya"));
  const ask = soul.split("## Always ask first")[1].split("##")[0];
  expect(ask).toContain("Sending messages");
  expect(ask).toContain("spending money");
  expect(soul).toContain("Runs my week");
});

test("interviewProgress ignores the hidden opener", () => {
  const thread = [u("[[start]]"), a("Q1"), u("bakery"), a("Q2"), u("mornings")];
  expect(interviewProgress(bot, thread)).toEqual({ answered: 2, done: false });
  expect(interviewProgress({ ...bot, interview: "done" }, thread)).toEqual({ answered: 2, done: true });
});

const modelSaying = (text: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
            finishReason: { unified: "stop", raw: undefined },
          },
        ],
      }),
    }),
  });

test("writeSoul keeps a complete soul from the model", async () => {
  const full = "# Maya\n\n## Personality\nDry.\n\n## How I talk\nShort.\n\n## What I own\nYour week.\n\n## Always ask first\nSending.\n\n## Never\nGuess.";
  expect(await writeSoul(bot, [u("hi")], modelSaying(full))).toBe(full);
});

test("writeSoul falls back when the model omits a heading", async () => {
  const soul = await writeSoul(bot, [u("I run a bakery")], modelSaying("# Maya\n\n## Personality\nDry."));
  for (const h of SOUL_HEADINGS) expect(soul).toContain(h.replace("{name}", "Maya"));
});
