import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { chatgptFetch } from "./fetch";
import { RESOURCE, getAccessToken } from "./oauth";

/** A Responses-API model that spends the user's ChatGPT plan allowance. */
export function chatgptModel(providerId: string, modelId: string): LanguageModel {
  // The real token is set per request by chatgptFetch; this placeholder only satisfies the SDK.
  const openai = createOpenAI({ apiKey: "chatgpt-plan", baseURL: RESOURCE, fetch: chatgptFetch(() => getAccessToken(providerId)) });
  return wrapLanguageModel({
    model: openai.responses(modelId),
    middleware: {
      // The plan never stores responses (chatgptFetch sends store:false). The SDK has to know too:
      // with its default (store on) it refers to earlier replies by item id instead of resending
      // them, and the plan answers 404 because those items were never stored.
      transformParams: async ({ params }) => ({
        ...params,
        providerOptions: { ...params.providerOptions, openai: { ...params.providerOptions?.openai, store: false } },
      }),
    },
  });
}
