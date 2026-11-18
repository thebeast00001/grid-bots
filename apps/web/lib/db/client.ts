import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { dataPath, ensureHome } from "../paths";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

type Open = { client: PGlite; db: Db; home: string };

// Cached on globalThis so dev hot reloads never open a second PGlite on the same folder.
const g = globalThis as unknown as { __gridDb?: Promise<Open> };

/** Migrations ship next to the code; every runtime (dev, tests, standalone) runs from apps/web. */
const migrationsFolder = () => process.env.GRID_MIGRATIONS ?? path.join(process.cwd(), "lib/db/migrations");

async function open(): Promise<Open> {
  await ensureHome();
  // Unit tests use an in-memory database: creating PGlite's ~1,000 data files is slow on Windows.
  const home = process.env.GRID_DB_MEMORY === "1" ? "memory://" : dataPath("db");
  const client = new PGlite(home);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return { client, db, home };
}

export async function getDb(): Promise<Db> {
  if (!g.__gridDb) {
    g.__gridDb = open().catch((e) => {
      g.__gridDb = undefined;
      throw e;
    });
  }
  return (await g.__gridDb).db;
}

/** Closes the database so the next getDb() reopens it (tests only). */
export async function resetDbForTests(): Promise<void> {
  const current = g.__gridDb;
  g.__gridDb = undefined;
  if (current) await (await current).client.close();
}
