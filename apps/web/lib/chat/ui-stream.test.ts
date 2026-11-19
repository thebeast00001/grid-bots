import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { isStepCount, simulateReadableStream, streamText, tool, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { chatUIStream } from "./ui-stream";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };

/** Calls the `boom` tool, then answers. */
function model() {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      call += 1;
      const chunks: LanguageModelV4StreamPart[] =
        call === 1
          ? [
              { type: "stream-start", warnings: [] },
              { type: "tool-call", toolCallId: "c1", toolName: "boom", input: "{}" },
              { type: "finish", usage, finishReason: { unified: "tool-calls", raw: undefined } },
            ]
          : [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: "Sorry, that failed." },
              { type: "text-end", id: "t" },
              { type: "finish", usage, finishReason: { unified: "stop", raw: undefined } },
            ];
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
}

test("a failed tool keeps the error text the model saw, so saved history matches what it was told", async () => {
  const tools = {
    boom: tool({
      inputSchema: z.object({}),
      execute: async (): Promise<string> => {
        throw new Error("The disk is full.");
      },
    }),
  };
  const result = streamText({ model: model(), prompt: "go", tools, stopWhen: isStepCount(3) });
  const reply = await new Promise<UIMessage | undefined>((resolve) => {
    const s = chatUIStream({ stream: result.stream, tools, originalMessages: [], messageId: "m1", onEnd: ({ messages }) => resolve(messages.at(-1)) });
    void (async () => {
      const r = s.getReader();
      while (!(await r.read()).done);
    })();
  });
  const part = reply?.parts.find((p) => p.type === "tool-boom") as { state: string; errorText: string } | undefined;
  // The SDK gives the model the error as a string ("Error: …"); the UI must show the same text, not Grid's JSON wrapper.
  expect(part).toMatchObject({ state: "output-error", errorText: "Error: The disk is full." });
});
