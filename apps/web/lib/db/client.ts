import { statSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { dataPath, ensureHome } from "../paths";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

type Open = {
  client: PGlite;
  db: Db;
  home: string;
  /** Which migration list was last applied (journal mtime + size). */
  journal: string;
  migrating?: Promise<void>;
};

// Cached on globalThis so dev hot reloads never open a second PGlite on the same folder.
const g = globalThis as unknown as { __gridDb?: Promise<Open> };

/** Migrations ship next to the code; every runtime (dev, tests, standalone) runs from apps/web. */
const migrationsFolder = () => process.env.GRID_MIGRATIONS ?? path.join(process.cwd(), "lib/db/migrations");

function journalStamp(): string {
  try {
    const s = statSync(path.join(migrationsFolder(), "meta/_journal.json"));
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return "";
  }
}

async function open(): Promise<Open> {
  await ensureHome();
  // Unit tests use an in-memory database: creating PGlite's ~1,000 data files is slow on Windows.
  const home = process.env.GRID_DB_MEMORY === "1" ? "memory://" : dataPath("db");
  const client = new PGlite(home);
  const db = drizzle({ client, schema });
  const journal = journalStamp();
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return { client, db, home, journal };
}

export async function getDb(): Promise<Db> {
  if (!g.__gridDb) {
    g.__gridDb = open().catch((e) => {
      g.__gridDb = undefined;
      throw e;
    });
  }
  const o = await g.__gridDb;
  // While developing, new code (and its migrations) arrives under a running server through
  // hot reload, but the database stays open. Apply new migrations as soon as they appear,
  // instead of failing with "relation does not exist" until a restart. A released build
  // never changes under itself, so it skips the check.
  if (process.env.NODE_ENV !== "production") {
    const stamp = journalStamp();
    if (stamp !== o.journal) {
      o.journal = stamp;
      o.migrating = migrate(o.db, { migrationsFolder: migrationsFolder() }).catch((e) => {
        o.journal = "";
        throw e;
      });
    }
    if (o.migrating) await o.migrating;
  }
  return o.db;
}

/** Closes the database so the next getDb() reopens it (tests only). */
export async function resetDbForTests(): Promise<void> {
  const current = g.__gridDb;
  g.__gridDb = undefined;
  if (current) await (await current).client.close();
}
