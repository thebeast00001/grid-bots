import { z } from "zod";
import { HttpStatus, errorResponse, readJson } from "@/lib/http";
import { removeItems, updateItem } from "@/lib/lists/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const Patch = z.object({
  text: z.string().max(1000).optional(),
  done: z.boolean().optional(),
  amount: z.number().int().nullable().optional(),
  spentOn: z.string().max(20).nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id, itemId } = await params;
    return Response.json(await updateItem(id, itemId, Patch.parse(await readJson(req))));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, itemId } = await params;
    if (!(await removeItems(id, [itemId]))) throw new HttpStatus(404, "not-found", "Item not found.");
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
