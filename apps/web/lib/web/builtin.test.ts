import { openai } from "@ai-sdk/openai";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { APICallError, simulateReadableStream, streamText, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { GridModelError } from "../models/errors";
import { builtinRefused, searchFallback } from "./builtin";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const say = (text: string) =>
  simulateReadableStream({
    chunks: [
      { type: "stream-start" as const, warnings: [] },
      { type: "text-start" as const, id: "t" },
      { type: "text-delta" as const, id: "t", delta: text },
      { type: "text-end" as const, id: "t" },
      { type: "finish" as const, usage, finishReason: { unified: "stop" as const, raw: undefined } },
    ],
  });

/** A provider that refuses its own search tool with `status`. */
function refusing(status: number) {
  const calls: LanguageModelV4CallOptions[] = [];
  const model = new MockLanguageModelV4({
    doStream: async (options) => {
      calls.push(options);
      if (options.tools?.some((t) => t.type === "provider")) {
        throw new APICallError({ message: "Tool 'web_search' is not supported with this model.", url: "https://api.example/v1/responses", requestBodyValues: {}, statusCode: status });
      }
      return { stream: say("answered without search") };
    },
  });
  return { model, calls };
}

test("a refused built-in search is dropped, retried once, and remembered", async () => {
  const { model, calls } = refusing(400);
  const r = streamText({ model: wrapLanguageModel({ model, middleware: searchFallback("prov_1:gpt-x") }), prompt: "hi", tools: { web_search: openai.tools.webSearch({}) } });
  expect(await r.text).toBe("answered without search");
  expect(calls).toHaveLength(2);
  expect(calls[1].tools ?? []).toHaveLength(0);
  expect(builtinRefused("prov_1:gpt-x")).toBe(true);
  expect(builtinRefused("prov_1:other")).toBe(false);
});

test("other failures aren't retried", async () => {
  const { model, calls } = refusing(500);
  // (No SDK retries, so the count is this middleware's alone.)
  const r = streamText({ model: wrapLanguageModel({ model, middleware: searchFallback("prov_2:gpt-x") }), prompt: "hi", tools: { web_search: openai.tools.webSearch({}) }, maxRetries: 0 });
  await expect(r.text).rejects.toThrow();
  expect(calls).toHaveLength(1);
  expect(builtinRefused("prov_2:gpt-x")).toBe(false);
});

test("calls without a built-in tool pass straight through", async () => {
  const { model, calls } = refusing(400);
  const r = streamText({ model: wrapLanguageModel({ model, middleware: searchFallback("prov_3:gpt-x") }), prompt: "hi" });
  expect(await r.text).toBe("answered without search");
  expect(calls).toHaveLength(1);
});

test("ChatGPT's own way of refusing the tool counts too", async () => {
  for (const [i, err] of [
    new GridModelError("unsupported", "The ChatGPT plan doesn't support this (tools)."),
    new GridModelError("unknown", "ChatGPT couldn't answer: Tool type 'web_search' is not supported."),
  ].entries()) {
    const calls: LanguageModelV4CallOptions[] = [];
    const model = new MockLanguageModelV4({
      doStream: async (options) => {
        calls.push(options);
        if (options.tools?.some((t) => t.type === "provider")) throw err;
        return { stream: say("plain") };
      },
    });
    const r = streamText({ model: wrapLanguageModel({ model, middleware: searchFallback(`chatgpt_${i}:gpt`) }), prompt: "hi", tools: { web_search: openai.tools.webSearch({}) }, maxRetries: 0 });
    expect(await r.text).toBe("plain");
    expect(calls).toHaveLength(2);
  }
  // A ChatGPT failure that has nothing to do with the tool isn't retried.
  let tries = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => {
      tries++;
      throw new GridModelError("limit", "You've hit your ChatGPT plan limit.");
    },
  });
  const r = streamText({ model: wrapLanguageModel({ model, middleware: searchFallback("chatgpt_x:gpt") }), prompt: "hi", tools: { web_search: openai.tools.webSearch({}) }, maxRetries: 0 });
  await expect(r.text).rejects.toThrow();
  expect(tries).toBe(1);
  expect(builtinRefused("chatgpt_x:gpt")).toBe(false);
});
