import type { Bot } from "../bots/repo";
import type { Memory } from "../db/schema";

export const INTERVIEW_QUESTIONS = 5;

/** Pinned first, then newest, until the text budget is used up. */
export function pickMemories(all: Memory[], budgetChars = 6000): Memory[] {
  const sorted = [...all].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const out: Memory[] = [];
  let used = 0;
  for (const m of sorted) {
    used += m.text.length + 4;
    if (used > budgetChars) break;
    out.push(m);
  }
  return out;
}

const bullets = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none yet)");

export function buildInstructions(p: {
  bot: Bot;
  botMemories: Memory[];
  userMemories: Memory[];
  now: Date;
  interview: { pending: boolean; answered: number };
  tools: boolean;
}): string {
  const { bot } = p;
  const rules = [
    "Be warm and brief. Plain words, no filler, no lists unless they help.",
    "Never claim to have done something you didn't do. In this version you can't browse the web, send messages or use other apps. If asked, say so and offer what you can do.",
  ];
  if (p.tools) {
    rules.push(
      "When the user shares something worth keeping about themselves (preferences, people, plans, facts), save it with the remember tool (about: \"user\"). Save notes about how to do your job with about: \"self\". Don't announce routine saves.",
      "You may react to the user's message with one emoji using the react tool when it genuinely fits. Use it rarely.",
    );
  }

  const sections = [
    `You are ${bot.name} (@${bot.handle}), a bot in Grid, the user's AI team.${bot.job ? ` Your job: ${bot.job}.` : ""}`,
    `Rules:\n${bullets(rules)}`,
    `# Your soul\n${bot.soul.trim() || "(Not written yet.)"}`,
    `# Standing instructions from the user\n${bullets(bot.instructions)}`,
    `# About the user\n${bullets(pickMemories(p.userMemories).map((m) => m.text))}`,
    `# Your notes\n${bullets(pickMemories(p.botMemories).map((m) => m.text))}`,
    `Current date and time: ${p.now.toUTCString()} (${p.now.toISOString().slice(0, 10)}).`,
  ];

  if (p.interview.pending) {
    const n = Math.min(p.interview.answered + 1, INTERVIEW_QUESTIONS);
    sections.push(
      `[[interview]]\nYou are meeting the user for the first time. Get to know them and your job by asking ${INTERVIEW_QUESTIONS} short questions in total, one per message: their goals, what they want off their plate, how they like to be talked to, what you must always check with them first, and anything else you need. This is question ${n} of ${INTERVIEW_QUESTIONS}. Briefly acknowledge their last answer if there is one, then ask only that question.`,
    );
  }
  return sections.join("\n\n");
}
