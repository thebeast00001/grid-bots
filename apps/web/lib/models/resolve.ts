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
import { GridModelError } from "./errors";
import { PROVIDER_KINDS, type ModelRef, type ProviderKind } from "./kinds";
import { mockModel } from "./mock";
import { loadProvider, type LoadedProvider } from "./providers-repo";

export type ResolvedModel = { model: LanguageModel; ref: ModelRef; tools: boolean; kind: ProviderKind };

const NO_MODEL = () =>
  new GridModelError("no-model", "Connect a model to start chatting.", { action: { label: "Connect a model", href: "/welcome" } });

/** Builds a model for a provider. The ChatGPT plan is added by lib/models/chatgpt. */
export type ChatgptFactory = (p: LoadedProvider, modelId: string) => LanguageModel;
let chatgptFactory: ChatgptFactory | null = null;
export function registerChatgptFactory(f: ChatgptFactory) {
  chatgptFactory = f;
}

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
      if (!chatgptFactory) throw new GridModelError("unsupported", "ChatGPT sign-in isn't available yet.");
      return chatgptFactory(p, modelId);
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

/** The bot's model, else the default model, else a no-model error with a way to fix it. */
export async function resolveModel(ref?: ModelRef | null): Promise<ResolvedModel> {
  const r = ref ?? (await getSetting<ModelRef>("defaultModel"));
  if (!r) throw NO_MODEL();
  let p: LoadedProvider;
  try {
    p = await loadProvider(r.providerId);
  } catch {
    throw NO_MODEL();
  }
  return { model: makeModel(p, r.modelId), ref: r, tools: await supportsTools(p, r.modelId), kind: p.kind };
}
