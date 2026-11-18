import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  await getDb();
  return Response.json({ ok: true, db: true });
}
