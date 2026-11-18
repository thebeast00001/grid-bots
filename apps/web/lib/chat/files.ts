import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { files, type FileRow } from "../db/schema";
import { HttpStatus } from "../http";
import { dataPath } from "../paths";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown"];

export type Upload = { id: string; url: string; name: string; mediaType: string };

export async function saveUpload(botId: string, file: File): Promise<Upload> {
  if (file.size > MAX_FILE_BYTES) throw new HttpStatus(413, "too-big", "Files can be up to 10 MB.");
  const mediaType = file.type.split(";")[0];
  if (!ALLOWED_TYPES.includes(mediaType)) throw new HttpStatus(415, "bad-type", "Images, PDFs and text files only.");
  const id = `file_${randomBytes(8).toString("hex")}`;
  await mkdir(dataPath("files"), { recursive: true });
  await writeFile(dataPath("files", id), Buffer.from(await file.arrayBuffer()));
  const db = await getDb();
  const name = file.name.slice(0, 200) || "file";
  await db.insert(files).values({ id, botId, name, mediaType, size: file.size });
  return { id, url: `/api/files/${id}`, name, mediaType };
}

export async function loadUpload(id: string): Promise<{ row: FileRow; data: Buffer } | null> {
  if (!/^file_[a-f0-9]{16}$/.test(id)) return null;
  const db = await getDb();
  const [row] = await db.select().from(files).where(eq(files.id, id));
  if (!row) return null;
  return { row, data: await readFile(dataPath("files", id)) };
}

/** Models can't fetch Grid's local URLs, so attachments go to them as data URLs. */
export async function inlineFileParts(msgs: UIMessage[]): Promise<UIMessage[]> {
  return Promise.all(
    msgs.map(async (m) => ({
      ...m,
      parts: await Promise.all(
        m.parts.map(async (part) => {
          if (part.type !== "file" || !part.url.startsWith("/api/files/")) return part;
          const loaded = await loadUpload(part.url.slice("/api/files/".length));
          if (!loaded) return { type: "text" as const, text: `[missing attachment: ${part.filename ?? "file"}]` };
          return { ...part, url: `data:${loaded.row.mediaType};base64,${loaded.data.toString("base64")}` };
        }),
      ),
    })),
  );
}
