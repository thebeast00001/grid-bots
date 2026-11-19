import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ReminderView } from "../client-types";
import { HttpStatus } from "../http";
import { addMemory } from "../memory/repo";
import { cancelReminder, createReminder, getReminder, listReminders, updateReminder } from "../reminders/repo";
import { TIME_HELP } from "../reminders/resolve";
import { REPEATS, formatWhen, parseRepeat, parseWhen, repeatLabel } from "../reminders/when";
import { createRoutine, deleteRoutine, getRoutineRow, listRoutines, setPaused, updateRoutine } from "../routines/repo";
import { resolveSchedule } from "../routines/schedule";
import { patchMessageMeta } from "./history";

export const REACTIONS = ["❤️", "👍", "😂", "🔥", "👀", "😮"] as const;

const ASK = " Ask the user, then try again.";
const NOT_FOUND = { ok: false as const, error: "No reminder with that id. Use list_reminders to find it." };

/** Every bot's tools: remembering, reacting, reminders and routines. `zone` is the user's time zone. */
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

  const NO_ROUTINE = { ok: false as const, error: "No routine with that id. Use list_routines to find it." };
  const nextLabel = (iso: string | null) => (iso ? formatWhen(new Date(iso), { now: new Date(), zone }) : null);
  const myRoutine = async (id: string) => {
    const r = await getRoutineRow(id);
    return r && r.botId === p.botId ? r : null;
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
    create_routine: tool({
      description:
        'Set up a routine: a job you will do on your own on a schedule, e.g. "every weekday at 8am give me a briefing". At each time you run the instruction and post the result in this chat. For a one-off nudge use set_reminder instead.',
      inputSchema: z.object({
        name: z.string().min(1).max(60).describe('A short title: "Morning briefing".'),
        instruction: z.string().min(1).max(2000).describe("What to do each time, in the user's words, complete enough to follow on your own later."),
        when: z.string().min(1).max(200).describe('When, in the user\'s own words: "every weekday at 8am", "every Sunday 6pm", "tomorrow at 7".'),
      }),
      execute: async ({ name, instruction, when }) => {
        const s = await resolveSchedule(when);
        if (!s.ok) return { ok: false as const, error: s.message + ASK };
        try {
          const routine = await createRoutine({ botId: p.botId, name, instruction, at: s.at, repeat: s.repeat });
          return { ok: true as const, routine, next: nextLabel(routine.nextRunAt) };
        } catch (e) {
          return failed(e);
        }
      },
    }),
    list_routines: tool({
      description: "List this bot's routines with their ids, schedules and next run.",
      inputSchema: z.object({}),
      execute: async () => ({
        routines: (await listRoutines(p.botId)).map((r) => ({
          id: r.id,
          name: r.name,
          instruction: r.instruction,
          schedule: r.scheduleLabel,
          next: nextLabel(r.nextRunAt),
          paused: r.status === "paused",
        })),
      }),
    }),
    update_routine: tool({
      description: "Change a routine's name, instruction or time, or pause/resume it. Get its id from list_routines.",
      inputSchema: z.object({
        id: z.string(),
        name: z.string().min(1).max(60).optional(),
        instruction: z.string().min(1).max(2000).optional(),
        when: z.string().min(1).max(200).optional().describe("The new time in the user's words."),
        paused: z.boolean().optional(),
      }),
      execute: async ({ id, name, instruction, when, paused }) => {
        const current = await myRoutine(id);
        if (!current) return NO_ROUTINE;
        let at: Date | undefined;
        let repeat = undefined as (typeof current)["repeat"] | undefined;
        if (when) {
          const s = await resolveSchedule(when, current.repeat);
          if (!s.ok) return { ok: false as const, error: s.message + ASK };
          at = s.at;
          repeat = s.repeat;
        }
        try {
          let routine = await updateRoutine(id, { name, instruction, at, repeat });
          if (paused !== undefined) routine = await setPaused(id, paused);
          return routine ? { ok: true as const, routine, next: nextLabel(routine.nextRunAt) } : NO_ROUTINE;
        } catch (e) {
          return failed(e);
        }
      },
    }),
    delete_routine: tool({
      description: "Delete a routine for good. Get its id from list_routines.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        if (!(await myRoutine(id))) return NO_ROUTINE;
        await deleteRoutine(id);
        return { ok: true as const };
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
