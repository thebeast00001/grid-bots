import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
    pool: "forks",
    // Each test file starts its own in-process Postgres (PGlite). More than a few at once
    // starves CPU and memory: 14 parallel files took ~90 s each vs ~5 s alone.
    maxWorkers: 4,
    env: { GRID_DB_MEMORY: "1" },
    // Opening PGlite and running migrations takes a few seconds when files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
