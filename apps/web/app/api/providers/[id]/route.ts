import { errorResponse } from "@/lib/http";
import type { ModelRef } from "@/lib/models/kinds";
import { removeProvider } from "@/lib/models/providers-repo";
import { deleteSetting, getSetting } from "@/lib/settings";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await removeProvider(id);
    const def = await getSetting<ModelRef | null>("defaultModel");
    if (def?.providerId === id) await deleteSetting("defaultModel");
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
