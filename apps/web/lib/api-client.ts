/** Browser-side helper for Grid's own API. Always sends `x-grid: 1` (see lib/guard.ts). */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message;
    super(msg ?? `Request failed (${status})`);
  }
}

export const GRID_HEADERS = { "x-grid": "1" } as const;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-grid", "1");
  if (typeof init.body === "string" && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
