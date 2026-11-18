import { loadUpload } from "@/lib/chat/files";
import { errorResponse, notFound } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const loaded = await loadUpload((await params).id);
    if (!loaded) throw notFound("File");
    return new Response(new Uint8Array(loaded.data), {
      headers: {
        "content-type": loaded.row.mediaType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(loaded.row.name)}`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
