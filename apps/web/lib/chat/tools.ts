import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ReminderView } from "../client-types";
import { HttpStatus } from "../http";
import { addMemory } from "../memory/repo";
import { cancelReminder, createReminder, getReminder, listReminders, updateReminder } from "../reminders/repo";
import { TIME_HELP } from "../reminders/resolve";
import { REPEATS, formatWhen, parseRepeat, parseWhen, repeatLabel } from "../reminders/when";
import { patchMessageMeta } from "./history";

export const REACTIONS = ["❤️", "👍", "😂", "🔥", "👀", "😮"] as const;

const ASK = " Ask the user, then try again.";
const NOT_FOUND = { ok: false as const, error: "No reminder with that id. Use list_reminders to find it." };

/** Every bot's tools: remembering, reacting and reminders. `zone` is the user's time zone. */
export function makeTools(p: { botId: string; lastUserMessageId?: string; zone: string }): ToolSet {
  const { zone } = p;
  const at = (when: string) => {
    const r = parseWhen(when, { now: new Date(), zone });
    if (!("error" in r)) return { at: r.at };
    return { error: TIME_HELP[r.error === "past" ? "past-time" : "unclear-time"] + ASK };
  };
  const summary = (r: ReminderView) => ({
    when: formatWhen(new Date(r.dueAt), { now: new Date(), zone }),
    repeatLabel: repeatLabel(r.repeat, new Date(r.dueAt), zone),
  });
  const done = (r: ReminderView) => ({ ok: true as const, reminder: r, ...summary(r) });
  /** Only this bot's reminders can be changed or cancelled. */
  const mine = async (id: string) => {
    const r = await getReminder(id);
    return r && r.botId === p.botId ? r : null;
  };
  const failed = (e: unknown) => {
    if (e instanceof HttpStatus) return { ok: false as const, error: e.message };
    throw e;
  };

  return {
    remember: tool({
      description: "Save something worth remembering. about=user for facts about the user (shared with all their bots); about=self for notes on how to do your job.",
      inputSchema: z.object({ text: z.string().min(1).max(500), about: z.enum(["user", "self"]) }),
      execute: async ({ text, about }) => {
        const m = await addMemory({ botId: about === "self" ? p.botId : null, text, source: "bot", sourceMessageId: p.lastUserMessageId });
        return { saved: true, id: m.id };
      },
    }),
    // Only in a conversation: a routine running on its own has no message to react to.
    ...(p.lastUserMessageId
      ? {
          react: tool({
            description: "React to the user's latest message with one emoji.",
            inputSchema: z.object({ emoji: z.enum(REACTIONS) }),
            execute: async ({ emoji }) => {
              await patchMessageMeta(p.lastUserMessageId!, { botReaction: emoji });
              return { reacted: emoji };
            },
          }),
        }
      : {}),
    set_reminder: tool({
      description:
        'Set a reminder. Use it for anything time-based the user asks for ("remind me…", "every Monday…"). The reminder arrives in this chat at that time. Tell the user the exact time it returns.',
      inputSchema: z.object({
        text: z.string().min(1).max(500).describe('What to remind them about, short, in their words: "Pay rent".'),
        when: z.string().min(1).max(200).describe('When, in the user\'s own words: "Friday 6pm", "in 2 hours", "every day at 9am".'),
        repeat: z.enum(REPEATS).optional().describe("Only if it repeats and `when` doesn't already say so."),
      }),
      execute: async ({ text, when, repeat }) => {
        const w = at(when);
        if ("error" in w) return { ok: false as const, error: w.error };
        try {
          const r = await createReminder({ botId: p.botId, text, at: w.at, repeat: repeat ?? parseRepeat(when) ?? "none", sourceMessageId: p.lastUserMessageId });
          return done(r);
        } catch (e) {
          return failed(e);
        }
      },
    }),
    list_reminders: tool({
      description: "List this bot's upcoming reminders, soonest first, with their ids.",
      inputSchema: z.object({}),
      execute: async () => ({
        reminders: (await listReminders({ botId: p.botId, upcoming: true })).map((r) => ({ id: r.id, text: r.text, ...summary(r) })),
      }),
    }),
    change_reminder: tool({
      description: "Change a reminder's text, time or repeat. Get its id from list_reminders.",
      inputSchema: z.object({
        id: z.string(),
        text: z.string().min(1).max(500).optional(),
        when: z.string().min(1).max(200).optional().describe("The new time in the user's words."),
        repeat: z.enum(REPEATS).optional(),
      }),
      execute: async ({ id, text, when, repeat }) => {
        if (!(await mine(id))) return NOT_FOUND;
        let time: Date | undefined;
        if (when) {
          const w = at(when);
          if ("error" in w) return { ok: false as const, error: w.error };
          time = w.at;
        }
        try {
          const r = await updateReminder(id, { text, at: time, repeat: repeat ?? (when ? (parseRepeat(when) ?? undefined) : undefined) });
          return r ? done(r) : NOT_FOUND;
        } catch (e) {
          return failed(e);
        }
      },
    }),
    cancel_reminder: tool({
      description: "Cancel a reminder. Get its id from list_reminders.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        if (!(await mine(id))) return NOT_FOUND;
        const r = await cancelReminder(id);
        return r ? done(r) : NOT_FOUND;
      },
    }),
  };
}
