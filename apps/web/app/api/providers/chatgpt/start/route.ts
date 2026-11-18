import { errorResponse } from "@/lib/http";
import { startChatgptSignIn } from "@/lib/models/chatgpt/oauth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return Response.json(await startChatgptSignIn({ appOrigin: new URL(req.url).origin }));
  } catch (e) {
    return errorResponse(e);
  }
}
