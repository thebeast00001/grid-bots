import { z } from "zod";
import { errorResponse, notFound, readJson } from "@/lib/http";
import { deleteMemory, updateMemory } from "@/lib/memory/repo";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({ text: z.string().max(1000).optional(), pinned: z.boolean().optional() });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    return Response.json(await updateMemory((await params).id, Patch.parse(await readJson(req))));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    if (!(await deleteMemory((await params).id))) throw notFound("Memory");
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
