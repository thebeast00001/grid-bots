import { z } from "zod";
import { getBot } from "@/lib/bots/repo";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { addMemory, listMemories, searchMemories } from "@/lib/memory/repo";

export const dynamic = "force-dynamic";

/** GET ?scope=you (shared, about the user) | bot&botId=… (a bot's own notes), optional q= search. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "you";
    const q = url.searchParams.get("q")?.trim();
    const botId = scope === "bot" ? url.searchParams.get("botId") : null;
    if (scope === "bot" && !botId) throw new HttpStatus(400, "bad-scope", "botId is required for scope=bot.");
    return Response.json({ memories: q ? await searchMemories(botId, q) : await listMemories(botId) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({
  botId: z.string().nullable(),
  text: z.string().min(1).max(1000),
  pinned: z.boolean().optional(),
  sourceMessageId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await readJson(req));
    if (body.botId && !(await getBot(body.botId))) throw notFound("Bot");
    const m = await addMemory({ botId: body.botId, text: body.text, source: "you", sourceMessageId: body.sourceMessageId, pinned: body.pinned });
    return Response.json(m, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
