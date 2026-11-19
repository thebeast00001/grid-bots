import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { deleteList, getList, renameList } from "@/lib/lists/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    return Response.json(await getList((await params).id));
  } catch (e) {
    return errorResponse(e);
  }
}

const Patch = z.object({ name: z.string().max(1000) });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { name } = Patch.parse(await readJson(req));
    return Response.json(await renameList((await params).id, name));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteList((await params).id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
