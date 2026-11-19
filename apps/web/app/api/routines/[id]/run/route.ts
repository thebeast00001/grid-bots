import { errorResponse } from "@/lib/http";
import { startRun } from "@/lib/routines/run";

/** Run now: answers at once with the run id; the result arrives in the chat (and as events). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { runId } = await startRun((await params).id, "manual");
    return Response.json({ runId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
