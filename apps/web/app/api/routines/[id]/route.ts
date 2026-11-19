import { z } from "zod";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { deleteRoutine, getRoutineRow, setPaused, updateRoutine } from "@/lib/routines/repo";
import { resolveSchedule } from "@/lib/routines/schedule";
import type { Repeat } from "@/lib/reminders/when";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({ name: z.string().optional(), instruction: z.string().optional(), when: z.string().max(200).optional(), paused: z.boolean().optional() });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = Patch.parse(await readJson(req));
    const current = await getRoutineRow(id);
    if (!current) throw notFound("Routine");
    let at: Date | undefined;
    let repeat: Repeat | undefined;
    if (body.when !== undefined) {
      const s = await resolveSchedule(body.when, current.repeat);
      if (!s.ok) throw new HttpStatus(400, s.code, s.message);
      at = s.at;
      repeat = s.repeat;
    }
    let r = await updateRoutine(id, { name: body.name, instruction: body.instruction, at, repeat });
    if (body.paused !== undefined) r = await setPaused(id, body.paused);
    if (!r) throw notFound("Routine");
    return Response.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    if (!(await deleteRoutine((await params).id))) throw notFound("Routine");
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
