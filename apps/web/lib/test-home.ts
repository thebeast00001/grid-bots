import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Point GRID_HOME at a fresh temp folder. Call at the top of a test file. */
export function useTempHome(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "grid-test-"));
  process.env.GRID_HOME = dir;
  return dir;
}
