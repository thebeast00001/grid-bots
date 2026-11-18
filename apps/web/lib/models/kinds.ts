export type { ModelRef } from "./types";

export type ProviderKind =
  | "openai" | "anthropic" | "google" | "xai" | "groq" | "mistral" | "deepseek" | "openrouter"
  | "ollama" | "lmstudio" | "custom" | "chatgpt" | "mock";

export type KindInfo = {
  label: string;
  /** key: API key required · optional-key: custom servers · none: local · oauth: ChatGPT plan */
  auth: "key" | "optional-key" | "none" | "oauth";
  baseUrl?: string;
  keyUrl?: string;
  recommended?: string;
  local?: boolean;
};

export const PROVIDER_KINDS: Record<ProviderKind, KindInfo> = {
  openai: { label: "OpenAI", auth: "key", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic (Claude)", auth: "key", keyUrl: "https://console.anthropic.com/settings/keys", recommended: "claude-opus-5-5" },
  google: { label: "Google Gemini", auth: "key", keyUrl: "https://aistudio.google.com/apikey" },
  xai: { label: "xAI (Grok)", auth: "key", baseUrl: "https://api.x.ai/v1", keyUrl: "https://console.x.ai" },
  groq: { label: "Groq", auth: "key", baseUrl: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys" },
  mistral: { label: "Mistral", auth: "key", baseUrl: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai/api-keys" },
  deepseek: { label: "DeepSeek", auth: "key", baseUrl: "https://api.deepseek.com/v1", keyUrl: "https://platform.deepseek.com/api_keys" },
  openrouter: { label: "OpenRouter", auth: "key", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys" },
  ollama: { label: "Ollama", auth: "none", baseUrl: "http://127.0.0.1:11434", local: true },
  lmstudio: { label: "LM Studio", auth: "none", baseUrl: "http://127.0.0.1:1234/v1", local: true },
  custom: { label: "Custom (OpenAI-compatible)", auth: "optional-key" },
  chatgpt: { label: "ChatGPT plan", auth: "oauth", baseUrl: "https://api.openai.com/v1" },
  mock: { label: "Test model", auth: "none" },
};

/** Claude copy required by the plan's Global Constraints. */
export const CLAUDE_NOTE = "Claude subscriptions can't be used in third-party apps. Use an API key instead.";

/** The test model exists only for automated tests. */
export const mockAllowed = () => process.env.GRID_E2E === "1" || process.env.VITEST === "true";

export const isProviderKind = (k: string): k is ProviderKind => k in PROVIDER_KINDS && (k !== "mock" || mockAllowed());

export function availableKinds(): ProviderKind[] {
  return (Object.keys(PROVIDER_KINDS) as ProviderKind[]).filter((k) => k !== "mock" || mockAllowed());
}
