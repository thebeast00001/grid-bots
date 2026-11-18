import { z } from "zod";
import { patchMessageMeta } from "@/lib/chat/history";
import { errorResponse, notFound, readJson } from "@/lib/http";

const Patch = z.object({ reaction: z.string().max(16).nullable() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { reaction } = Patch.parse(await readJson(req));
    const metadata = await patchMessageMeta((await params).id, { reaction });
    if (!metadata) throw notFound("Message");
    return Response.json({ metadata });
  } catch (e) {
    return errorResponse(e);
  }
}
