import { errorResponse } from "@/lib/http";
import { listModels } from "@/lib/models/catalog";
import { loadProvider } from "@/lib/models/providers-repo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json({ models: await listModels(await loadProvider(id)) });
  } catch (e) {
    return errorResponse(e);
  }
}
