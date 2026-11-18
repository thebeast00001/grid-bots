import { mkdir, rm, writeFile } from "node:fs/promises";
import type { Memory } from "../db/schema";
import { dataPath } from "../paths";
import type { Bot } from "./repo";

/**
 * Readable copies of each bot's soul and memory under GRID_HOME, so people can
 * open, back up and diff them. One-way in M1: the database is the source of truth.
 */

const list = (items: Memory[]) =>
  items.length === 0 ? "_Nothing yet._\n" : items.map((m) => `- ${m.pinned ? "📌 " : ""}${m.text.replace(/\n+/g, " ")}`).join("\n") + "\n";

function soulMarkdown(bot: Bot): string {
  const base = bot.soul.trim() || `# ${bot.name}\n\n${bot.job || "A new bot. The interview will fill this in."}`;
  const rules = bot.instructions.length ? `\n\n## Standing instructions\n${bot.instructions.map((i) => `- ${i}`).join("\n")}` : "";
  return `${base}${rules}\n`;
}

export async function mirrorBot(bot: Bot, memories: Memory[]): Promise<void> {
  const dir = dataPath("bots", bot.handle);
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/SOUL.md`, soulMarkdown(bot), "utf8");
  await writeFile(`${dir}/MEMORY.md`, `# ${bot.name}'s notes\n\n${list(memories)}`, "utf8");
}

export async function mirrorUser(memories: Memory[]): Promise<void> {
  await mkdir(dataPath(), { recursive: true });
  await writeFile(dataPath("USER.md"), `# About you\n\n${list(memories)}`, "utf8");
}

export async function removeMirror(handle: string): Promise<void> {
  await rm(dataPath("bots", handle), { recursive: true, force: true });
}
