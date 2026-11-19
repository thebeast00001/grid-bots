import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { wrapLanguageModel, type LanguageModel, type Tool } from "ai";
import { getSetting } from "../settings";
import { builtinRefused, searchFallback } from "../web/builtin";
import { builtInSearch, getSearchService } from "../web/search";
import { listModels } from "./catalog";
import { chatgptModel } from "./chatgpt/model";
import { GridModelError } from "./errors";
import { PROVIDER_KINDS, type ModelRef, type ProviderKind } from "./kinds";
import { mockModel } from "./mock";
import { listProviders, loadProvider, type LoadedProvider } from "./providers-repo";

export type ResolvedModel = {
  model: LanguageModel;
  ref: ModelRef;
  tools: boolean;
  kind: ProviderKind;
  /** How the bot searches the web: Grid's web_search (a search service is set), the model's own search, or not at all. */
  search: "grid" | "builtin" | null;
  /** The provider's own search tool, when search is "builtin". */
  searchTool?: Tool;
};

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
  const tools = await supportsTools(p, r.modelId);
  const base = { model: makeModel(p, r.modelId), ref: r, tools, kind: p.kind };
  if (!tools) return { ...base, search: null };
  // A search service the user set is used with every model; otherwise the model's own search, if it has one.
  if (await getSearchService()) return { ...base, search: "grid" };
  const key = `${p.id}:${r.modelId}`;
  if (!builtInSearch(p.kind) || builtinRefused(key)) return { ...base, search: null };
  return {
    ...base,
    model: wrapLanguageModel({ model: base.model as Parameters<typeof wrapLanguageModel>[0]["model"], middleware: searchFallback(key) }),
    search: "builtin",
    searchTool: p.kind === "anthropic" ? anthropic.tools.webSearch_20250305({ maxUses: 3 }) : openai.tools.webSearch({}),
  };
}
