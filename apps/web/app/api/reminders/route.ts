import { z } from "zod";
import { getBot } from "@/lib/bots/repo";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { createReminder, listReminders } from "@/lib/reminders/repo";
import { resolveWhen } from "@/lib/reminders/resolve";
import { REPEATS, parseRepeat } from "@/lib/reminders/when";

export const dynamic = "force-dynamic";

/** GET ?botId=…&upcoming=1 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    return Response.json({ reminders: await listReminders({ botId: q.get("botId") ?? undefined, upcoming: q.get("upcoming") === "1" }) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Create = z.object({
  botId: z.string().min(1),
  text: z.string(),
  when: z.string().max(200),
  repeat: z.enum(REPEATS).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Create.parse(await readJson(req));
    if (!(await getBot(body.botId))) throw notFound("Bot");
    const w = await resolveWhen(body.when);
    if (!w.ok) throw new HttpStatus(400, w.code, w.message);
    const repeat = body.repeat ?? parseRepeat(body.when) ?? "none";
    return Response.json(await createReminder({ botId: body.botId, text: body.text, at: w.at, repeat }), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
