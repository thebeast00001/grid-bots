import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { APICallError, type LanguageModelMiddleware } from "ai";
import { GridModelError } from "../models/errors";

/**
 * Some models (or accounts) refuse their provider's own search tool: an older model, an
 * organisation that hasn't enabled it. Rather than break the chat, a refused call is sent
 * again without the tool, and that model is remembered as "no built-in search" until Grid
 * restarts (resolveModel then leaves the tool out).
 */

const refused = new Set<string>();
const REFUSALS = new Set([400, 403, 404, 422]);

export const builtinRefused = (key: string) => refused.has(key);

const hasProviderTool = (p: LanguageModelV4CallOptions) => !!p.tools?.some((t) => t.type === "provider");
const withoutProviderTools = (p: LanguageModelV4CallOptions): LanguageModelV4CallOptions => {
  const tools = p.tools?.filter((t) => t.type !== "provider");
  const forced = p.toolChoice?.type === "tool" && !tools?.some((t) => t.name === (p.toolChoice as { toolName: string }).toolName);
  return { ...p, tools, toolChoice: forced ? undefined : p.toolChoice };
};

/** A provider's "no" to the tool: an HTTP refusal, or the ChatGPT plan's own wording (see chatgpt/errors.ts). */
function isRefusal(e: unknown): boolean {
  if (APICallError.isInstance(e)) return REFUSALS.has(e.statusCode ?? 0);
  if (e instanceof GridModelError) return e.code === "unsupported" || (e.code === "unknown" && /web.?search|tools?/i.test(e.message));
  return false;
}

function refusedBy(e: unknown, key: string): boolean {
  if (!isRefusal(e)) return false;
  refused.add(key);
  console.warn(`[grid] ${key} refused its own web search; answering without it.`);
  return true;
}

export function searchFallback(key: string): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      if (!hasProviderTool(params)) return doGenerate();
      try {
        return await doGenerate();
      } catch (e) {
        if (!refusedBy(e, key)) throw e;
        return model.doGenerate(withoutProviderTools(params));
      }
    },
    wrapStream: async ({ doStream, params, model }) => {
      if (!hasProviderTool(params)) return doStream();
      try {
        return await doStream();
      } catch (e) {
        if (!refusedBy(e, key)) throw e;
        return model.doStream(withoutProviderTools(params));
      }
    },
  };
}
