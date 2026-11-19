import { errorResponse, notFound } from "@/lib/http";
import { getRoutineRow, listRuns } from "@/lib/routines/repo";

export const dynamic = "force-dynamic";

/** The routine's last 10 runs, newest first. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await getRoutineRow(id))) throw notFound("Routine");
    return Response.json({ runs: await listRuns(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
