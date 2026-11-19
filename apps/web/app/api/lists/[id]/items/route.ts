import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { addItems, getList, reorder } from "@/lib/lists/repo";
import { NewItem } from "@/lib/lists/input";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Add = z.object({ items: z.array(NewItem).min(1).max(50) });

/** Adds items at the end. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { items } = Add.parse(await readJson(req));
    return Response.json({ items: await addItems((await params).id, items) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Order = z.object({ ids: z.array(z.string().max(100)).max(300) });

/** A new order for the open items (all items, for habits). */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { ids } = Order.parse(await readJson(req));
    await reorder(id, ids);
    return Response.json(await getList(id));
  } catch (e) {
    return errorResponse(e);
  }
}
