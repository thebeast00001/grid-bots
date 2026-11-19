import { getDb } from "@/lib/db/client";
import { bots, files, memories, messages, providers, reminders, settings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Wipes all data. Exists only for the e2e suite (GRID_E2E=1); 404 otherwise. */
export async function POST() {
  if (process.env.GRID_E2E !== "1") return new Response(null, { status: 404 });
  const db = await getDb();
  for (const t of [reminders, messages, memories, files, bots, providers, settings]) await db.delete(t);
  return new Response(null, { status: 204 });
}
