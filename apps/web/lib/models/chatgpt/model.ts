import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { chatgptFetch } from "./fetch";
import { RESOURCE, getAccessToken } from "./oauth";

/** A Responses-API model that spends the user's ChatGPT plan allowance. */
export function chatgptModel(providerId: string, modelId: string): LanguageModel {
  // The real token is set per request by chatgptFetch; this placeholder only satisfies the SDK.
  const openai = createOpenAI({ apiKey: "chatgpt-plan", baseURL: RESOURCE, fetch: chatgptFetch(() => getAccessToken(providerId)) });
  return openai.responses(modelId);
}
