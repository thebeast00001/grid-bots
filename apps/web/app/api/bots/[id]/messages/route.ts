import { START, loadThread, textOf } from "@/lib/chat/history";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const thread = await loadThread((await params).id);
    return Response.json({ messages: thread.filter((m) => !(m.role === "user" && textOf(m).startsWith(START))) });
  } catch (e) {
    return errorResponse(e);
  }
}
