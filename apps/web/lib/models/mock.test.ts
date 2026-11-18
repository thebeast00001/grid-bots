import { isStepCount, streamText, tool } from "ai";
import { z } from "zod";
import { mockModel } from "./mock";

test("echoes the last user message", async () => {
  const r = streamText({ model: mockModel(), prompt: "hello there" });
  expect(await r.text).toBe("You said: hello there");
});

test("asks numbered interview questions while the interview marker is present", async () => {
  const r = streamText({
    model: mockModel(),
    instructions: "rules [[interview]]",
    messages: [
      { role: "user", content: "[[start]]" },
      { role: "assistant", content: "Question 1: what should I know?" },
      { role: "user", content: "I run a bakery" },
    ],
  });
  expect(await r.text).toBe("Question 2: what should I know?");
});

test("writes a soul when the soul marker is present", async () => {
  const r = streamText({ model: mockModel(), instructions: "[[soul]]", prompt: "transcript" });
  const text = await r.text;
  for (const h of ["# ", "## Personality", "## How I talk", "## What I own", "## Always ask first", "## Never"]) expect(text).toContain(h);
});

test("calls the remember tool when asked to remember and tools are offered", async () => {
  const saved: string[] = [];
  const r = streamText({
    model: mockModel(),
    prompt: "remember I like tea",
    tools: {
      remember: tool({
        description: "save",
        inputSchema: z.object({ text: z.string(), about: z.enum(["user", "self"]) }),
        execute: async ({ text }) => {
          saved.push(text);
          return { saved: true };
        },
      }),
    },
    stopWhen: isStepCount(3),
  });
  expect(await r.text).toContain("Got it.");
  expect(saved).toEqual(["I like tea"]);
});
