import path from "node:path";
import type { NextConfig } from "next";

// Scripts run from apps/web, so the repo root is two levels up.
const repoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  // The e2e server uses its own build folder so it can run beside `pnpm dev`.
  distDir: process.env.GRID_DIST_DIR ?? ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  devIndicators: false,
};

export default nextConfig;
