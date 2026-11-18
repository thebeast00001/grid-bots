import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { listModels } from "@/lib/models/catalog";
import { GridModelError } from "@/lib/models/errors";
import { CLAUDE_NOTE, PROVIDER_KINDS, availableKinds, isProviderKind, type ModelRef } from "@/lib/models/kinds";
import { addProvider, listProviders, loadProvider } from "@/lib/models/providers-repo";
import { getSetting, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const kinds = availableKinds().map((kind) => ({ kind, ...PROVIDER_KINDS[kind], note: kind === "anthropic" ? CLAUDE_NOTE : undefined }));
    return Response.json({ providers: await listProviders(), kinds });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({
  kind: z.string(),
  label: z.string().max(60).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await readJson(req));
    if (!isProviderKind(body.kind)) throw new GridModelError("unsupported", `Unknown provider "${body.kind}".`);
    const provider = await addProvider({ ...body, kind: body.kind });

    // The first connection picks the default model: the recommended one if offered, else the first.
    if (!(await getSetting<ModelRef>("defaultModel"))) {
      const models = await listModels(await loadProvider(provider.id));
      const pick = models.find((m) => m.id === PROVIDER_KINDS[provider.kind].recommended) ?? models[0];
      if (pick) await setSetting("defaultModel", { providerId: provider.id, modelId: pick.id } satisfies ModelRef);
    }
    return Response.json(provider, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
