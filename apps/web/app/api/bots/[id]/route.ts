import { deleteBot, getBot, muteBot, updateBot } from "@/lib/bots/repo";
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
    const id = (await params).id;
    const { mute, ...patch } = BotPatchBody.parse(await readJson(req));
    let bot = mute !== undefined ? await muteBot(id, mute) : null;
    if (Object.keys(patch).length > 0 || !bot) bot = await updateBot(id, patch);
    return Response.json(bot);
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
