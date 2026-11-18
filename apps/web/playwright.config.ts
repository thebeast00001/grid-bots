import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3299;
const home = path.resolve(import.meta.dirname, ".grid-test/e2e");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // Fresh data dir per run, separate build dir so it can run beside `pnpm dev`.
    command: `node -e "require('fs').rmSync(process.env.GRID_HOME,{recursive:true,force:true})" && pnpm exec next dev -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/lab`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { GRID_HOME: home, GRID_E2E: "1", GRID_DIST_DIR: ".next-e2e" },
  },
});
