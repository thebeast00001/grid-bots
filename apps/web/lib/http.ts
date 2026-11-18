import { ZodError } from "zod";
import { GridModelError, toGridError, type GridErrorCode } from "./models/errors";

const STATUS: Record<GridErrorCode, number> = {
  "no-model": 409,
  auth: 401,
  limit: 429,
  unavailable: 503,
  unsupported: 400,
  network: 502,
  unknown: 500,
};

/** A typed JSON error `{ error: { code, message, action? } }` the UI can act on. */
export function errorResponse(e: unknown): Response {
  if (e instanceof ZodError) {
    return Response.json({ error: { code: "unsupported", message: e.issues[0]?.message ?? "Invalid request." } }, { status: 400 });
  }
  if (e instanceof HttpStatus) return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  const g = e instanceof GridModelError ? e : toGridError(e);
  if (g.code === "unknown") console.error(e);
  return Response.json({ error: g.toJSON() }, { status: STATUS[g.code] });
}

/** Plain HTTP errors for non-model problems (not found, bad input). */
export class HttpStatus extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpStatus(404, "not-found", `${what} not found.`);

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpStatus(400, "bad-json", "Body must be JSON.");
  }
}
