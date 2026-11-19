import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import type { ModelRef } from "@/lib/models/kinds";
import { loadProvider } from "@/lib/models/providers-repo";
import { getSetting } from "@/lib/settings";
import { SEARCH_KINDS, builtInSearch, getSearchService, setSearchService } from "@/lib/web/search";

export const dynamic = "force-dynamic";

/** The search service (never its key), and the default model's own search if it has one. */
async function current() {
  let builtIn: { label: string } | null = null;
  const ref = await getSetting<ModelRef>("defaultModel");
  if (ref) {
    try {
      builtIn = builtInSearch((await loadProvider(ref.providerId)).kind);
    } catch {
      // Its connection was removed.
    }
  }
  return { service: await getSearchService(), builtIn };
}

export async function GET() {
  try {
    return Response.json(await current());
  } catch (e) {
    return errorResponse(e);
  }
}

const Patch = z.object({
  service: z
    .object({
      kind: z.enum(SEARCH_KINDS),
      key: z.string().max(300).optional(),
      url: z.string().max(500).optional(),
    })
    .nullable(),
});

export async function PATCH(req: Request) {
  try {
    const { service } = Patch.parse(await readJson(req));
    await setSearchService(service);
    return Response.json(await current());
  } catch (e) {
    return errorResponse(e);
  }
}
