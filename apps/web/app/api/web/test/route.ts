import { HttpStatus, errorResponse } from "@/lib/http";
import { getSearchService, search } from "@/lib/web/search";

export const dynamic = "force-dynamic";

/** Settings → Web's Test button: one real search with the saved service. */
export async function POST() {
  try {
    if (!(await getSearchService())) throw new HttpStatus(400, "bad-request", "Pick a search service first.");
    const r = await search("weather today");
    return Response.json(r.ok ? { ok: true, count: r.results.length } : { ok: false, error: r.error });
  } catch (e) {
    return errorResponse(e);
  }
}
