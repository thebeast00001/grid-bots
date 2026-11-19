#!/usr/bin/env node
// gridbots: run Grid on your own machine. `npx gridbots@latest`
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const pkgDir = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));

const HELP = `gridbots ${version}: your AI team, open source.

Usage: gridbots [options]

  --port <n>     Port to use (default 3210, or the next free one)
  --home <dir>   Where Grid keeps its data (default ~/.grid, or $GRID_HOME)
  --no-open      Don't open the browser
  -h, --help     Show this help
  -v, --version  Show the version

Grid only listens on 127.0.0.1, so other devices can't reach it.`;

function parseArgs(argv) {
  const opts = { port: undefined, home: undefined, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") opts.port = Number(argv[++i]);
    else if (a.startsWith("--port=")) opts.port = Number(a.slice(7));
    else if (a === "--home") opts.home = argv[++i];
    else if (a.startsWith("--home=")) opts.home = a.slice(7);
    else if (a === "--no-open") opts.open = false;
    else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      console.log(version);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${a}\n\n${HELP}`);
      process.exit(2);
    }
  }
  if (opts.port !== undefined && !(Number.isInteger(opts.port) && opts.port > 0 && opts.port < 65536)) {
    console.error("--port must be a number between 1 and 65535");
    process.exit(2);
  }
  return opts;
}

const free = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });

async function pickPort(wanted) {
  if (wanted !== undefined) {
    if (await free(wanted)) return wanted;
    console.error(`Port ${wanted} is in use. Pick another with --port.`);
    process.exit(1);
  }
  for (let p = 3210; p < 3240; p++) if (await free(p)) return p;
  console.error("No free port between 3210 and 3239. Pick one with --port.");
  process.exit(1);
}

/** Puts back the node_modules folders the package had to ship as _modules (see scripts/bundle.mjs). */
function restoreNodeModules(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name === "_modules") {
      const target = path.join(dir, "node_modules");
      renameSync(p, target);
      restoreNodeModules(target);
    } else {
      restoreNodeModules(p);
    }
  }
}

/** Recreates the symlinks npm can't ship (listed by scripts/bundle.mjs in links.json). */
function restoreLinks(dir) {
  const manifest = path.join(dir, "links.json");
  if (!existsSync(manifest)) return;
  for (const { link, target } of JSON.parse(readFileSync(manifest, "utf8"))) {
    const at = path.join(dir, link);
    mkdirSync(path.dirname(at), { recursive: true });
    rmSync(at, { recursive: true, force: true });
    // Junctions need no admin rights on Windows; elsewhere a relative link survives moves.
    if (process.platform === "win32") symlinkSync(path.join(dir, target), at, "junction");
    else symlinkSync(path.relative(path.dirname(at), path.join(dir, target)), at, "dir");
  }
}

/** Which build the bundled app is (scripts/bundle.mjs writes it); the version for older bundles. */
function bundleId(bundled) {
  const file = path.join(bundled, "bundle-id");
  return existsSync(file) ? readFileSync(file, "utf8").trim() : version;
}

/** First run of each build: unpack the bundled server into GRID_HOME/runtime/<version>. */
function ensureRuntime(home) {
  const runtime = path.join(home, "runtime", version);
  const server = path.join(runtime, "apps/web/server.js");
  const ready = path.join(runtime, ".ready");
  const bundled = path.join(pkgDir, "app");
  if (!existsSync(bundled)) {
    console.error("This copy of gridbots has no bundled app. If you're in the repo, run `pnpm bundle:cli` first.");
    process.exit(1);
  }
  const id = bundleId(bundled);
  if (existsSync(ready) && readFileSync(ready, "utf8").trim() === id) return server;
  console.log("Setting up Grid (first run of this build)…");
  const tmp = `${runtime}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  cpSync(bundled, tmp, { recursive: true });
  restoreNodeModules(tmp);
  rmSync(runtime, { recursive: true, force: true });
  renameSync(tmp, runtime);
  // Links go in after the move: a Windows junction stores an absolute path.
  restoreLinks(runtime);
  writeFileSync(ready, `${id}\n`);
  return server;
}

async function waitForHealth(url, child, ms = 120_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child.exitCode !== null) return false;
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // No browser available: the URL is printed anyway.
  }
}

const opts = parseArgs(process.argv.slice(2));
const home = path.resolve(opts.home ?? process.env.GRID_HOME ?? path.join(os.homedir(), ".grid"));
const port = await pickPort(opts.port);
const server = ensureRuntime(home);

const child = spawn(process.execPath, [server], {
  cwd: path.dirname(server),
  env: { ...process.env, GRID_HOME: home, PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const stop = () => {
  if (child.exitCode === null) child.kill();
};
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

const url = `http://127.0.0.1:${port}`;
if (!(await waitForHealth(`${url}/api/health`, child))) {
  console.error(`Grid didn't start.\n\n${log.slice(-4000)}`);
  stop();
  process.exit(1);
}
console.log(`Grid is running at ${url}`);
console.log(`Data: ${home}   (Ctrl+C to stop)`);
if (opts.open) openBrowser(url);

// Keep streaming server output once it's up.
child.stdout.on("data", (d) => process.stdout.write(d));
child.stderr.on("data", (d) => process.stderr.write(d));
child.on("exit", (code) => process.exit(code ?? 0));
