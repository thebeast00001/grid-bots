import { deleteBot, getBot, updateBot } from "@/lib/bots/repo";
import { BotPatchBody } from "@/lib/bots/schema";
import { errorResponse, notFound, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const bot = await getBot((await params).id);
    if (!bot) throw notFound("Bot");
    return Response.json(bot);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const patch = BotPatchBody.parse(await readJson(req));
    return Response.json(await updateBot((await params).id, patch));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteBot((await params).id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
