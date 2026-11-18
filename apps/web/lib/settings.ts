import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { settings } from "./db/schema";

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row ? (row.value as T) : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, key));
}

/** Stable, opaque id for this install (used by Sign in with ChatGPT). Holds no user data. */
export async function hostId(): Promise<string> {
  const existing = await getSetting<string>("hostId");
  if (existing) return existing;
  const id = `urn:uuid:${randomUUID()}`;
  await setSetting("hostId", id);
  return id;
}
