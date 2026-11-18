import { errorResponse } from "@/lib/http";
import { listModels } from "@/lib/models/catalog";
import { getAccessToken } from "@/lib/models/chatgpt/oauth";
import { loadProvider } from "@/lib/models/providers-repo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const p = await loadProvider(id);
    // ChatGPT tokens last an hour: refresh before listing.
    if (p.kind === "chatgpt") p.secret = { ...p.secret, access: await getAccessToken(id) };
    return Response.json({ models: await listModels(p) });
  } catch (e) {
    return errorResponse(e);
  }
}
