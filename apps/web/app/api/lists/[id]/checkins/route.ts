import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { checkIn, getList } from "@/lib/lists/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ itemId: z.string().max(100), day: z.string().max(20), on: z.boolean() });

/** Marks a habit done (or not) on a day; returns the list. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { itemId, day, on } = Body.parse(await readJson(req));
    await checkIn(id, itemId, day, on);
    return Response.json(await getList(id));
  } catch (e) {
    return errorResponse(e);
  }
}
