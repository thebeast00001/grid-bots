import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { useTempHome } from "../test-home";
import { getDb, resetDbForTests } from "./client";

useTempHome();
afterAll(() => resetDbForTests());

const real = path.join(process.cwd(), "lib/db/migrations");
const journal = JSON.parse(readFileSync(path.join(real, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };

/** A migrations folder with only the first `n` migrations, like an older checkout. */
function writeMigrations(dir: string, n: number) {
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const entries = journal.entries.slice(0, n);
  for (const e of entries) copyFileSync(path.join(real, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  writeFileSync(path.join(dir, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
}

test("migrations added while the server runs are applied without a restart", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "grid-migrations-"));
  process.env.GRID_MIGRATIONS = dir;
  try {
    // The dev server opened the database before routines existed…
    writeMigrations(dir, 2);
    const before = await getDb();
    await expect(before.execute(sql`select count(*) from routines`)).rejects.toThrow(/routines/);

    // …then the code (and its migrations) updated under it.
    writeMigrations(dir, journal.entries.length);
    const after = await getDb();
    await expect(after.execute(sql`select count(*) from routines`)).resolves.toBeTruthy();
  } finally {
    delete process.env.GRID_MIGRATIONS;
  }
});
