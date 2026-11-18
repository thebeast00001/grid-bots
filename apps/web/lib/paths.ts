import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Grid's data folder: `GRID_HOME`, or `~/.grid`. Read on every call so tests can switch it. */
export function gridHome(): string {
  return process.env.GRID_HOME ? path.resolve(process.env.GRID_HOME) : path.join(os.homedir(), ".grid");
}

export function dataPath(...parts: string[]): string {
  return path.join(gridHome(), ...parts);
}

export async function ensureHome(): Promise<void> {
  await mkdir(gridHome(), { recursive: true });
}
