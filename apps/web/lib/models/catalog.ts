import { GridModelError, HttpError, toGridError } from "./errors";
import { PROVIDER_KINDS, type ProviderKind } from "./kinds";

export type ModelInfo = { id: string; name: string; tools: boolean | null; vision: boolean | null };

export type CatalogProvider = {
  kind: ProviderKind;
  baseUrl: string | null;
  secret: Record<string, unknown> | null;
};

const OPENAI_STYLE: ProviderKind[] = ["openai", "xai", "groq", "mistral", "deepseek", "openrouter", "lmstudio", "custom"];
const UNKNOWN_TOOLS: ProviderKind[] = ["lmstudio", "custom"];

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new HttpError(res.status, await res.text().catch(() => null));
  return (await res.json()) as T;
}

const key = (p: CatalogProvider) => (typeof p.secret?.apiKey === "string" ? p.secret.apiKey : undefined);

async function listUnchecked(p: CatalogProvider): Promise<ModelInfo[]> {
  const base = p.baseUrl ?? PROVIDER_KINDS[p.kind].baseUrl ?? "";
  if (OPENAI_STYLE.includes(p.kind)) {
    const k = key(p);
    const body = await getJson<{ data?: { id: string }[] }>(`${base}/models`, { headers: k ? { authorization: `Bearer ${k}` } : {} });
    const tools = UNKNOWN_TOOLS.includes(p.kind) ? null : true;
    return (body.data ?? []).map((m) => ({ id: m.id, name: m.id, tools, vision: null }));
  }
  switch (p.kind) {
    case "anthropic": {
      const body = await getJson<{ data?: { id: string; display_name?: string }[] }>("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": key(p) ?? "", "anthropic-version": "2023-06-01" },
      });
      return (body.data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.id, tools: true, vision: true }));
    }
    case "google": {
      const body = await getJson<{ models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] }>(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key(p) ?? "")}`,
      );
      return (body.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({ id: m.name.replace(/^models\//, ""), name: m.displayName ?? m.name, tools: true, vision: true }));
    }
    case "ollama": {
      const tags = await getJson<{ models?: { name: string }[] }>(`${base}/api/tags`);
      return Promise.all(
        (tags.models ?? []).map(async ({ name }) => {
          const show = await getJson<{ capabilities?: string[] }>(`${base}/api/show`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: name }),
          });
          const caps = show.capabilities ?? [];
          return { id: name, name, tools: caps.includes("tools"), vision: caps.includes("vision") };
        }),
      );
    }
    case "mock":
      return [{ id: "mock-chat", name: "Test model", tools: true, vision: true }];
    case "chatgpt":
      throw new GridModelError("unsupported", "ChatGPT sign-in isn't available yet.");
    default:
      throw new GridModelError("unsupported", `Unknown provider ${p.kind}.`);
  }
}

/** Lists the models a provider offers right now. Errors come back as GridModelError. */
export async function listModels(p: CatalogProvider): Promise<ModelInfo[]> {
  try {
    return await listUnchecked(p);
  } catch (e) {
    throw toGridError(e, PROVIDER_KINDS[p.kind]?.label);
  }
}
