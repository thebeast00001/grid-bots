import { getBot } from "@/lib/bots/repo";
import { saveUpload } from "@/lib/chat/files";
import { HttpStatus, errorResponse, notFound } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => {
      throw new HttpStatus(400, "bad-form", "Send the file as form data.");
    });
    const file = form.get("file");
    const botId = form.get("botId");
    if (!(file instanceof File) || typeof botId !== "string") throw new HttpStatus(400, "bad-form", "Missing file or botId.");
    if (!(await getBot(botId))) throw notFound("Bot");
    return Response.json(await saveUpload(botId, file), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
