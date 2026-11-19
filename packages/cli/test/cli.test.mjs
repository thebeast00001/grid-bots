// End-to-end check of the packed CLI: pack → npx → server answers /api/health.
// Needs the bundle first: `pnpm bundle:cli`.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const cli = path.resolve(import.meta.dirname, "..");
const PORT = 3297;
const isWin = process.platform === "win32";

/** npm/npx without a shell (a shell splits paths with spaces, e.g. C:\Users\Ansh Tyagi). */
function npmCommand(name) {
  if (!isWin) return [name, []];
  return [process.execPath, [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", `${name}-cli.js`)]];
}

function killTree(child) {
  if (!child.pid) return;
  if (isWin) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Already gone.
    }
  } else {
    child.kill("SIGTERM");
  }
}

async function waitForHealth(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no answer from ${url} within ${ms} ms`);
}

test("packed CLI starts and serves health", { timeout: 240_000 }, async () => {
  assert.ok(existsSync(path.join(cli, "app")), "run `pnpm bundle:cli` first");
  const work = mkdtempSync(path.join(os.tmpdir(), "gridbots-pack-"));
  const home = mkdtempSync(path.join(os.tmpdir(), "gridbots-home-"));
  const [npm, npmPre] = npmCommand("npm");
  const tgz = execFileSync(npm, [...npmPre, "pack", cli, "--pack-destination", work], { encoding: "utf8" }).trim().split(/\r?\n/).at(-1);
  const [npx, npxPre] = npmCommand("npx");
  // `npx <path-to.tgz>` would try to *run* the file; `--package` installs it and runs its bin.
  // Run from the temp folder so the repo's own workspace links can't shadow the package.
  const child = spawn(npx, [...npxPre, "--yes", "--package", path.join(work, tgz), "gridbots", "--no-open", "--port", String(PORT), "--home", home], {
    cwd: work,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  try {
    const res = await waitForHealth(`http://127.0.0.1:${PORT}/api/health`, 180_000);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, db: true });
    assert.match(out, new RegExp(`Grid is running at http://127\\.0\\.0\\.1:${PORT}`));
    assert.ok(existsSync(path.join(home, "db")), "database created in --home");
  } catch (e) {
    e.message += `\n--- gridbots output ---\n${out.slice(-3000)}`;
    throw e;
  } finally {
    killTree(child);
    for (const dir of [work, home]) {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
      } catch {
        // A file still locked by the stopped server; the OS temp cleanup gets it.
      }
    }
  }
});
