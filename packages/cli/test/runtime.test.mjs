// Fast check of the CLI's runtime unpacking, using a fake bundled server.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const cli = path.resolve(import.meta.dirname, "..");
const PORT = 3296;

/** A package folder with the real bin and a tiny server that reports which bundle it came from. */
function fakePackage(build) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "gridbots-fake-"));
  cpSync(path.join(cli, "bin"), path.join(dir, "bin"), { recursive: true });
  cpSync(path.join(cli, "package.json"), path.join(dir, "package.json"));
  const web = path.join(dir, "app", "apps", "web");
  mkdirSync(web, { recursive: true });
  writeFileSync(
    path.join(web, "server.js"),
    `require("node:http").createServer((q, s) => s.end(JSON.stringify({ ok: true, build: ${JSON.stringify(build)} }))).listen(process.env.PORT, "127.0.0.1");`,
  );
  writeFileSync(path.join(dir, "app", "bundle-id"), `${build}\n`);
  return dir;
}

/** Starts the CLI, returns the build its server reports, then stops it. */
async function runOnce(pkg, home) {
  const child = spawn(process.execPath, [path.join(pkg, "bin", "gridbots.mjs"), "--no-open", "--port", String(PORT), "--home", home], { stdio: "pipe" });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  try {
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      if (out.includes("Grid is running")) return (await (await fetch(`http://127.0.0.1:${PORT}/api/health`)).json()).build;
      if (child.exitCode !== null) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`CLI didn't start:\n${out}`);
  } finally {
    child.kill();
    await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
  }
}

test("a rebuilt bundle of the same version replaces the unpacked runtime", { timeout: 90_000 }, async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "gridbots-home-"));
  const first = fakePackage("build-one");
  const second = fakePackage("build-two");
  try {
    assert.equal(await runOnce(first, home), "build-one");
    assert.equal(await runOnce(first, home), "build-one");
    assert.equal(await runOnce(second, home), "build-two");
  } finally {
    for (const d of [home, first, second]) rmSync(d, { recursive: true, force: true, maxRetries: 5 });
  }
});
