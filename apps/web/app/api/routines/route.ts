import { z } from "zod";
import { getBot } from "@/lib/bots/repo";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { createRoutine, listRoutines } from "@/lib/routines/repo";
import { resolveSchedule } from "@/lib/routines/schedule";

export const dynamic = "force-dynamic";

/** GET ?botId=… */
export async function GET(req: Request) {
  try {
    const botId = new URL(req.url).searchParams.get("botId");
    if (!botId) throw new HttpStatus(400, "bad-request", "botId is required.");
    return Response.json({ routines: await listRoutines(botId) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Create = z.object({ botId: z.string().min(1), name: z.string(), instruction: z.string(), when: z.string().max(200) });

export async function POST(req: Request) {
  try {
    const body = Create.parse(await readJson(req));
    if (!(await getBot(body.botId))) throw notFound("Bot");
    const s = await resolveSchedule(body.when);
    if (!s.ok) throw new HttpStatus(400, s.code, s.message);
    return Response.json(await createRoutine({ botId: body.botId, name: body.name, instruction: body.instruction, at: s.at, repeat: s.repeat }), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
