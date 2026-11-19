import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import type { ModelRef } from "@/lib/models/kinds";
import { deleteSetting, getSetting, isZone, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function current() {
  return {
    defaultModel: (await getSetting<ModelRef | null>("defaultModel")) ?? null,
    chatgptWelcomeSeen: (await getSetting<boolean>("chatgptWelcomeSeen")) ?? false,
    timezone: (await getSetting<string>("timezone")) ?? null,
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
  /** The browser's IANA zone, so reminders go off at the user's local time. */
  timezone: z.string().refine(isZone, "Unknown time zone.").optional(),
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
