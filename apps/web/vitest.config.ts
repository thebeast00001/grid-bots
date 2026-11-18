import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
    pool: "forks",
    // Opening PGlite and running migrations takes a few seconds when files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
