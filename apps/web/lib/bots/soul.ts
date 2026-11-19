import { streamText, type LanguageModel, type UIMessage } from "ai";
import { START, textOf } from "../chat/history";
import { INTERVIEW_QUESTIONS } from "../chat/instructions";
import type { Bot } from "./repo";

export { INTERVIEW_QUESTIONS };

/** SOUL.md must have exactly these sections ("{name}" is the bot's name). */
export const SOUL_HEADINGS = ["# {name}", "## Personality", "## How I talk", "## What I own", "## Always ask first", "## Never"];

const isOpener = (m: UIMessage) => m.role === "user" && textOf(m).startsWith(START);

export function interviewProgress(bot: Bot, thread: UIMessage[]): { answered: number; done: boolean } {
  const answered = thread.filter((m) => m.role === "user" && !isOpener(m)).length;
  return { answered, done: bot.interview !== "pending" };
}

export function defaultSoul(bot: Bot): string {
  return [
    `# ${bot.name}`,
    "",
    "## Personality",
    "Warm, calm and brief. Curious about what you need.",
    "",
    "## How I talk",
    "Short sentences, plain words, no jargon. I ask when something is unclear.",
    "",
    "## What I own",
    bot.job || "Whatever you hand me. Tell me my job and I'll keep it.",
    "",
    "## Always ask first",
    "Sending messages, spending money, deleting things, and anything I can't undo.",
    "",
    "## Never",
    "Pretend to have done something I didn't, or share what you told me with anyone.",
    "",
  ].join("\n");
}

const hasAllHeadings = (soul: string, name: string) => SOUL_HEADINGS.every((h) => soul.includes(h.replace("{name}", name)));

/** One streamed call (the ChatGPT plan only streams) that turns the interview into SOUL.md. */
export async function writeSoul(bot: Bot, thread: UIMessage[], model: LanguageModel): Promise<string> {
  const transcript = thread
    .filter((m) => !isOpener(m))
    .map((m) => `${m.role === "user" ? "User" : bot.name}: ${textOf(m)}`)
    .join("\n");
  const instructions = [
    "[[soul]]",
    `Write SOUL.md for ${bot.name}, a bot in Grid whose job is: ${bot.job || "(not set)"}.`,
    "Base it on the interview transcript. Write in the bot's first person. Keep each section to 1-3 short lines.",
    `Use exactly these headings, in this order, and nothing else:\n${SOUL_HEADINGS.map((h) => h.replace("{name}", bot.name)).join("\n")}`,
    "Under 'Always ask first' always include sending messages, spending money and deleting things.",
  ].join("\n\n");
  try {
    const result = streamText({ model, instructions, prompt: `Interview transcript:\n${transcript}` });
    const soul = (await result.text).trim();
    if (hasAllHeadings(soul, bot.name)) return soul;
  } catch {
    // Fall through to the default soul.
  }
  const summary = thread
    .filter((m) => m.role === "user" && !isOpener(m))
    .map(textOf)
    .filter(Boolean)
    .join(" · ")
    .slice(0, 400);
  return summary ? `${defaultSoul(bot)}\n## From our first chat\n${summary}\n` : defaultSoul(bot);
}
