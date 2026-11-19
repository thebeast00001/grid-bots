import { userZone } from "../settings";
import { parseWhen } from "./when";

export const TIME_HELP = {
  "unclear-time": "I couldn't tell when that is. Try a day and a time, like \"Friday 6pm\" or \"in 2 hours\".",
  "past-time": "That time has already passed. Pick a later one.",
} as const;

export type Resolved = { ok: true; at: Date; zone: string } | { ok: false; code: keyof typeof TIME_HELP; message: string };

/** Words → an instant in the user's zone, or a typed reason it can't be one. */
export async function resolveWhen(when: string, now = new Date()): Promise<Resolved> {
  const zone = await userZone();
  const p = parseWhen(when, { now, zone });
  if ("error" in p) {
    const code = p.error === "past" ? "past-time" : "unclear-time";
    return { ok: false, code, message: TIME_HELP[code] };
  }
  return { ok: true, at: p.at, zone };
}
