import { z } from "zod";
import { publish } from "@/lib/events";
import { HttpStatus, errorResponse, readJson } from "@/lib/http";
import { markRead } from "@/lib/notifications/repo";

const Body = z.object({ botId: z.string().optional(), ids: z.array(z.string()).max(500).optional(), all: z.boolean().optional() });

/** Marks a bot's notifications, some by id, or all of them read. */
export async function POST(req: Request) {
  try {
    const q = Body.parse(await readJson(req));
    if (!q.botId && !q.ids?.length && !q.all) throw new HttpStatus(400, "bad-request", "Say which: botId, ids or all.");
    const changed = await markRead(q);
    if (changed) publish({ type: "inbox" });
    return Response.json({ changed });
  } catch (e) {
    return errorResponse(e);
  }
}
