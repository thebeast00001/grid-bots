import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { NewItem } from "@/lib/lists/input";
import { LIST_KINDS, createList, listLists } from "@/lib/lists/repo";

export const dynamic = "force-dynamic";

/** Every list, newest change first, with counts (no items). */
export async function GET() {
  try {
    return Response.json({ lists: await listLists() });
  } catch (e) {
    return errorResponse(e);
  }
}

const Create = z.object({
  name: z.string().max(1000),
  kind: z.enum(LIST_KINDS as [string, ...string[]]),
  currency: z.string().max(10).nullable().optional(),
  items: z.array(NewItem).max(300).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Create.parse(await readJson(req));
    const list = await createList({ ...body, kind: body.kind as (typeof LIST_KINDS)[number] });
    return Response.json(list, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
