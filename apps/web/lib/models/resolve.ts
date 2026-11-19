import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { getSetting } from "../settings";
import { listModels } from "./catalog";
import { chatgptModel } from "./chatgpt/model";
import { GridModelError } from "./errors";
import { PROVIDER_KINDS, type ModelRef, type ProviderKind } from "./kinds";
import { mockModel } from "./mock";
import { listProviders, loadProvider, type LoadedProvider } from "./providers-repo";

export type ResolvedModel = { model: LanguageModel; ref: ModelRef; tools: boolean; kind: ProviderKind };

const NO_MODEL = () =>
  new GridModelError("no-model", "Connect a model to start chatting.", { action: { label: "Connect a model", href: "/welcome" } });

function makeModel(p: LoadedProvider, modelId: string): LanguageModel {
  const apiKey = typeof p.secret?.apiKey === "string" ? p.secret.apiKey : undefined;
  const baseURL = p.baseUrl ?? PROVIDER_KINDS[p.kind].baseUrl;
  switch (p.kind) {
    case "openai":
      return createOpenAI({ apiKey, baseURL })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey })(modelId);
    case "xai":
      return createXai({ apiKey })(modelId);
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "deepseek":
      return createDeepSeek({ apiKey })(modelId);
    case "openrouter":
    case "lmstudio":
    case "custom":
      return createOpenAICompatible({ name: p.kind, baseURL: baseURL ?? "", apiKey })(modelId);
    case "ollama":
      return createOpenAICompatible({ name: "ollama", baseURL: `${baseURL}/v1` })(modelId);
    case "chatgpt":
      return chatgptModel(p.id, modelId);
    case "mock":
      return mockModel();
  }
}

// Ollama reports tool support per model; remember it for a few minutes.
const toolCache = new Map<string, { tools: boolean; at: number }>();

async function supportsTools(p: LoadedProvider, modelId: string): Promise<boolean> {
  if (p.kind === "lmstudio" || p.kind === "custom") return false;
  if (p.kind !== "ollama") return true;
  const key = `${p.id}:${modelId}`;
  const hit = toolCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.tools;
  const models = await listModels(p).catch(() => []);
  const tools = models.find((m) => m.id === modelId)?.tools === true;
  toolCache.set(key, { tools, at: Date.now() });
  return tools;
}

const NO_DEFAULT = () =>
  new GridModelError("no-model", "Pick a default model for your bots.", { action: { label: "Choose a model", href: "/settings/models" } });

async function tryLoad(ref: ModelRef | null | undefined): Promise<{ p: LoadedProvider; r: ModelRef } | null> {
  if (!ref) return null;
  try {
    return { p: await loadProvider(ref.providerId), r: ref };
  } catch {
    return null; // Its connection was removed.
  }
}

/**
 * The bot's model, else the default model (also when the bot's connection was removed),
 * else a no-model error whose action fits: connect one, or pick a default among those connected.
 */
export async function resolveModel(ref?: ModelRef | null): Promise<ResolvedModel> {
  const found = (await tryLoad(ref)) ?? (await tryLoad(await getSetting<ModelRef>("defaultModel")));
  if (!found) throw (await listProviders()).length > 0 ? NO_DEFAULT() : NO_MODEL();
  const { p, r } = found;
  return { model: makeModel(p, r.modelId), ref: r, tools: await supportsTools(p, r.modelId), kind: p.kind };
}
