import { z } from "zod";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { cancelReminder, completeReminder, recordOccurrence, snoozeReminder, updateReminder } from "@/lib/reminders/repo";
import { resolveWhen } from "@/lib/reminders/resolve";
import { REPEATS, parseRepeat, snoozeUntil } from "@/lib/reminders/when";
import { userZone } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("done"), messageId: z.string().optional() }),
  z.object({ action: z.literal("snooze"), preset: z.enum(["10m", "1h", "evening", "tomorrow"]), messageId: z.string().optional() }),
]);
const Edit = z.object({ text: z.string().optional(), when: z.string().max(200).optional(), repeat: z.enum(REPEATS).optional() });

/** `{ action: "done" | "snooze", … }` acts on it; otherwise `{ text?, when?, repeat? }` changes it. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const now = new Date();

    if (body && typeof body === "object" && "action" in body) {
      const a = Action.parse(body);
      if (a.action === "done") {
        const r = await completeReminder(id);
        if (!r) throw notFound("Reminder");
        if (a.messageId) await recordOccurrence(a.messageId, id, { state: "done", at: now.toISOString() });
        return Response.json(r);
      }
      const until = snoozeUntil(a.preset, { now, zone: await userZone() });
      const r = await snoozeReminder(id, until);
      if (!r) throw notFound("Reminder");
      if (a.messageId) await recordOccurrence(a.messageId, id, { state: "snoozed", until: until.toISOString() });
      return Response.json(r);
    }

    const e = Edit.parse(body);
    let at: Date | undefined;
    if (e.when !== undefined) {
      const w = await resolveWhen(e.when, now);
      if (!w.ok) throw new HttpStatus(400, w.code, w.message);
      at = w.at;
    }
    const repeat = e.repeat ?? (e.when !== undefined ? (parseRepeat(e.when) ?? undefined) : undefined);
    const r = await updateReminder(id, { text: e.text, at, repeat });
    if (!r) throw notFound("Reminder");
    return Response.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Cancels it (the row stays, so the chat's card can say so). */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    if (!(await cancelReminder((await params).id))) throw notFound("Reminder");
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
