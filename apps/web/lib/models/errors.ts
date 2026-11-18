export type GridErrorCode = "no-model" | "auth" | "limit" | "unavailable" | "unsupported" | "network" | "unknown";

export type ErrorAction = { label: string; href: string };

/** A model/provider problem, worded for the person using Grid, with one way to fix it. */
export class GridModelError extends Error {
  readonly code: GridErrorCode;
  readonly action?: ErrorAction;
  constructor(code: GridErrorCode, message: string, opts: { action?: ErrorAction; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "GridModelError";
    this.code = code;
    this.action = opts.action;
  }
  toJSON() {
    return { code: this.code, message: this.message, action: this.action };
  }
}

/** A non-2xx HTTP response from a provider. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

export const SETTINGS_ACTION: ErrorAction = { label: "Check key", href: "/settings/models" };

function statusOf(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  for (const v of [o.status, o.statusCode, o.response?.status]) if (typeof v === "number") return v;
  return undefined;
}

function networkCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^E[A-Z]+/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export function toGridError(e: unknown, providerLabel = "the model server"): GridModelError {
  if (e instanceof GridModelError) return e;
  const status = statusOf(e);
  if (status === 401 || status === 403) {
    return new GridModelError("auth", `${providerLabel} rejected the key.`, { action: SETTINGS_ACTION, cause: e });
  }
  if (status === 429) {
    return new GridModelError("limit", `${providerLabel} is rate-limiting or out of credit. Try again in a moment.`, { cause: e });
  }
  if (status !== undefined && status >= 500) {
    return new GridModelError("unavailable", `${providerLabel} is having trouble right now. Try again in a moment.`, { cause: e });
  }
  if (networkCode(e) || (e instanceof TypeError && /fetch failed/i.test(e.message))) {
    return new GridModelError("network", `Can't reach ${providerLabel}.`, { cause: e });
  }
  const message = e instanceof Error ? e.message : String(e);
  return new GridModelError("unknown", message, { cause: e });
}
