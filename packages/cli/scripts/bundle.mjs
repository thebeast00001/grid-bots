// Builds the web app in standalone mode and copies it into packages/cli/app.
// npm drops every folder named node_modules from a package, so the server's
// dependencies ship as `_modules`; the CLI renames them on first run.
// npm also drops symlinks (Turbopack links hashed aliases such as
// `@electric-sql/pglite-<hash>` to the real package), so they ship as a list
// in links.json and the CLI recreates them.
import { execSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const web = path.join(root, "apps/web");
const standalone = path.join(web, ".next/standalone");
const out = path.resolve(import.meta.dirname, "../app");

execSync("pnpm --filter @grid/web build", { cwd: root, stdio: "inherit" });

rmSync(out, { recursive: true, force: true });
cpSync(standalone, out, { recursive: true, verbatimSymlinks: true });
cpSync(path.join(web, ".next/static"), path.join(out, "apps/web/.next/static"), { recursive: true });
cpSync(path.join(web, "public"), path.join(out, "apps/web/public"), { recursive: true });

// The e2e-only reset route ships too (it returns 404 unless GRID_E2E=1); nothing else to strip.

const posix = (p) => p.split(path.sep).join("/");

/** Replaces every symlink under `dir` with an entry in `links`, paths relative to the bundle root. */
function collectLinks(dir, links) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const rel = path.relative(out, p);
      const raw = readlinkSync(p);
      // Resolve against where the link sits in the original standalone build.
      const target = path.relative(standalone, path.resolve(path.dirname(path.join(standalone, rel)), raw));
      if (target.startsWith("..") || path.isAbsolute(target)) throw new Error(`symlink ${rel} points outside the bundle: ${raw}`);
      if (!existsSync(path.join(out, target))) throw new Error(`symlink ${rel} points at missing ${target}`);
      links.push({ link: posix(rel), target: posix(target) });
      rmSync(p, { recursive: true, force: true });
    } else if (st.isDirectory()) {
      collectLinks(p, links);
    }
  }
  return links;
}
const links = collectLinks(out, []);
writeFileSync(path.join(out, "links.json"), `${JSON.stringify(links, null, 2)}\n`);
// Identifies this build, so the CLI re-unpacks a rebuilt bundle of the same version.
writeFileSync(path.join(out, "bundle-id"), `${Date.now().toString(36)}-${process.pid}\n`);

/** Renames every node_modules folder under `dir` to _modules. */
function hideNodeModules(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name === "node_modules") {
      const target = path.join(dir, "_modules");
      renameSync(p, target);
      hideNodeModules(target);
    } else {
      hideNodeModules(p);
    }
  }
}
hideNodeModules(out);

if (!existsSync(path.join(out, "apps/web/server.js"))) throw new Error("standalone server.js missing");
console.log(`bundled into ${path.relative(root, out)} (${links.length} link${links.length === 1 ? "" : "s"})`);
