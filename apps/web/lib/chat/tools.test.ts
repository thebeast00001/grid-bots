import type { ToolSet } from "ai";
import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { listReminders } from "../reminders/repo";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { makeTools } from "./tools";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const zone = "Asia/Kolkata";

/** Runs one tool the way the AI SDK would. */
async function run(tools: ToolSet, name: string, input: unknown): Promise<Record<string, unknown>> {
  const t = tools[name];
  if (!t?.execute) throw new Error(`no tool ${name}`);
  return (await t.execute(input as never, { toolCallId: "call-1", messages: [], context: undefined })) as Record<string, unknown>;
}

test("set_reminder creates a reminder linked to the user's message", async () => {
  const bot = await createBot({ name: "Tooly", job: "", avatar });
  const tools = makeTools({ botId: bot.id, lastUserMessageId: "msg_user", zone });
  const out = await run(tools, "set_reminder", { text: "Pay rent", when: "in 2 hours" });
  expect(out).toMatchObject({ ok: true, reminder: { text: "Pay rent", repeat: "none" }, repeatLabel: null });
  expect(out.when).toMatch(/^(Today|Tomorrow), \d{1,2}:\d{2} (AM|PM)$/);
  expect(await listReminders({ botId: bot.id, upcoming: true })).toHaveLength(1);
});

test("set_reminder takes the repeat from the words when none is given", async () => {
  const bot = await createBot({ name: "Daily", job: "", avatar });
  const out = await run(makeTools({ botId: bot.id, lastUserMessageId: "m", zone }), "set_reminder", { text: "Vitamins", when: "every day at 9am" });
  expect(out).toMatchObject({ ok: true, reminder: { repeat: "daily" }, repeatLabel: "Every day at 9:00 AM" });
});

test("a past or unclear time stores nothing and tells the model to ask", async () => {
  const bot = await createBot({ name: "Careful", job: "", avatar });
  const tools = makeTools({ botId: bot.id, lastUserMessageId: "m", zone });
  const past = await run(tools, "set_reminder", { text: "x", when: "yesterday at 9am" });
  expect(past).toMatchObject({ ok: false });
  expect(past.error).toMatch(/already passed.*ask/i);
  const unclear = await run(tools, "set_reminder", { text: "x", when: "whenever" });
  expect(unclear.error).toMatch(/couldn't tell when.*ask/i);
  expect(await listReminders({ botId: bot.id })).toEqual([]);
});

test("list, change and cancel by id", async () => {
  const bot = await createBot({ name: "Keeper", job: "", avatar });
  const tools = makeTools({ botId: bot.id, lastUserMessageId: "m", zone });
  const set = (await run(tools, "set_reminder", { text: "Call mom", when: "in 1 hour" })) as { reminder: { id: string } };
  const id = set.reminder.id;

  const listed = await run(tools, "list_reminders", {});
  expect(listed).toMatchObject({ reminders: [{ id, text: "Call mom", repeatLabel: null }] });

  expect(await run(tools, "change_reminder", { id, text: "Call mom back", when: "in 5 hours" })).toMatchObject({
    ok: true,
    reminder: { text: "Call mom back" },
  });
  expect(await run(tools, "cancel_reminder", { id })).toMatchObject({ ok: true, reminder: { status: "cancelled" } });
  expect(await run(tools, "change_reminder", { id: "rem_000000000000", text: "x" })).toMatchObject({ ok: false });
});

test("a bot can't touch another bot's reminders", async () => {
  const a = await createBot({ name: "Alpha", job: "", avatar });
  const b = await createBot({ name: "Beta", job: "", avatar });
  const set = (await run(makeTools({ botId: a.id, lastUserMessageId: "m", zone }), "set_reminder", { text: "Mine", when: "in 1 hour" })) as {
    reminder: { id: string };
  };
  expect(await run(makeTools({ botId: b.id, lastUserMessageId: "m", zone }), "cancel_reminder", { id: set.reminder.id })).toMatchObject({ ok: false });
  expect((await listReminders({ botId: a.id, upcoming: true })).map((r) => r.id)).toEqual([set.reminder.id]);
});
