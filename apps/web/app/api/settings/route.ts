import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import type { ModelRef } from "@/lib/models/kinds";
import { deleteSetting, getSetting, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function current() {
  return {
    defaultModel: (await getSetting<ModelRef | null>("defaultModel")) ?? null,
    chatgptWelcomeSeen: (await getSetting<boolean>("chatgptWelcomeSeen")) ?? false,
  };
}

export async function GET() {
  try {
    return Response.json(await current());
  } catch (e) {
    return errorResponse(e);
  }
}

const Patch = z.object({
  defaultModel: z.object({ providerId: z.string().min(1), modelId: z.string().min(1) }).nullable().optional(),
  chatgptWelcomeSeen: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const body = Patch.parse(await readJson(req));
    for (const [k, v] of Object.entries(body)) {
      if (v === null) await deleteSetting(k);
      else if (v !== undefined) await setSetting(k, v);
    }
    return Response.json(await current());
  } catch (e) {
    return errorResponse(e);
  }
}
