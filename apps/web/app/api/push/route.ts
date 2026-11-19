import { z } from "zod";
import { errorResponse, readJson } from "@/lib/http";
import { pushPublicKey, removePushSubscription, savePushSubscription } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

/** The public key a browser needs to subscribe. */
export async function GET() {
  try {
    return Response.json({ publicKey: await pushPublicKey() });
  } catch (e) {
    return errorResponse(e);
  }
}

const Sub = z.object({
  endpoint: z.string().max(2000).url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function POST(req: Request) {
  try {
    await savePushSubscription(Sub.parse(await readJson(req)));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(await readJson(req));
    await removePushSubscription(endpoint);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
