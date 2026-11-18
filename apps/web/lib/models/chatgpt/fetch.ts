import { mapChatgptError } from "./errors";

/** Fields the ChatGPT plan rejects on the Responses API (docs: preview-limitations). */
const FORBIDDEN = [
  "background", "conversation", "max_output_tokens", "max_tool_calls", "metadata", "moderation", "prompt",
  "prompt_cache_retention", "safety_identifier", "temperature", "top_logprobs", "top_p", "truncation", "user",
  "previous_response_id",
];

export function rewriteResponsesBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const k of FORBIDDEN) delete out[k];
  out.store = false;
  out.stream = true;
  if (Array.isArray(out.input)) {
    out.input = out.input.map((item: unknown) =>
      item && typeof item === "object" && (item as { role?: string }).role === "system" ? { ...(item as object), role: "developer" } : item,
    );
  }
  return out;
}

/** A fetch for @ai-sdk/openai that spends the user's ChatGPT plan instead of an API key. */
export function chatgptFetch(getToken: () => Promise<string>): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${await getToken()}`);
    let body = init.body;
    if (typeof body === "string" && (init.method ?? "GET").toUpperCase() === "POST") {
      try {
        body = JSON.stringify(rewriteResponsesBody(JSON.parse(body)));
      } catch {
        // Not JSON: send as is.
      }
    }
    const res = await fetch(input, { ...init, headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      throw mapChatgptError(res.status, parsed);
    }
    return res;
  }) as typeof fetch;
}
