import { createBot, listBots } from "@/lib/bots/repo";
import { NewBot } from "@/lib/bots/schema";
import { errorResponse, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ bots: await listBots() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = NewBot.parse(await readJson(req));
    return Response.json(await createBot(body), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
