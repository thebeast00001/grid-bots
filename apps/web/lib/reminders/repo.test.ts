import { createBot, deleteBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { subscribe, type GridEvent } from "../events";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { cancelReminder, completeReminder, createReminder, getReminder, listReminders, updateReminder } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

test("creates, lists upcoming and cancels", async () => {
  const bot = await createBot({ name: "Remy", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Pay rent", at: inHours(2), repeat: "none" });
  expect(r).toMatchObject({ botId: bot.id, text: "Pay rent", repeat: "none", status: "scheduled", late: false, firedAt: null });
  expect(r.id).toMatch(/^rem_[0-9a-f]{12}$/);
  expect((await listReminders({ botId: bot.id, upcoming: true })).map((x) => x.id)).toEqual([r.id]);

  const cancelled = await cancelReminder(r.id);
  expect(cancelled?.status).toBe("cancelled");
  expect(await listReminders({ botId: bot.id, upcoming: true })).toEqual([]);
});

test("lists upcoming reminders soonest first", async () => {
  const bot = await createBot({ name: "Order", job: "", avatar });
  const later = await createReminder({ botId: bot.id, text: "Later", at: inHours(5), repeat: "none" });
  const sooner = await createReminder({ botId: bot.id, text: "Sooner", at: inHours(1), repeat: "none" });
  expect((await listReminders({ botId: bot.id, upcoming: true })).map((x) => x.id)).toEqual([sooner.id, later.id]);
});

test("changes the text, time and repeat", async () => {
  const bot = await createBot({ name: "Edit", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Call mom", at: inHours(1), repeat: "none" });
  const at = inHours(3);
  const changed = await updateReminder(r.id, { text: "Call mom back", at, repeat: "weekly" });
  expect(changed).toMatchObject({ text: "Call mom back", dueAt: at.toISOString(), repeat: "weekly", status: "scheduled" });
});

test("refuses empty or overlong text", async () => {
  const bot = await createBot({ name: "Strict", job: "", avatar });
  await expect(createReminder({ botId: bot.id, text: "  ", at: inHours(1), repeat: "none" })).rejects.toMatchObject({ code: "bad-text" });
  await expect(createReminder({ botId: bot.id, text: "x".repeat(501), at: inHours(1), repeat: "none" })).rejects.toMatchObject({ code: "bad-text" });
});

test("refuses a 201st upcoming reminder", async () => {
  const bot = await createBot({ name: "Busy", job: "", avatar });
  for (let i = 0; i < 200; i++) await createReminder({ botId: bot.id, text: `r${i}`, at: inHours(1 + i), repeat: "none" });
  await expect(createReminder({ botId: bot.id, text: "one more", at: inHours(1), repeat: "none" })).rejects.toMatchObject({ code: "too-many" });
});

test("deleting a bot removes its reminders", async () => {
  const bot = await createBot({ name: "Gone", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Bye", at: inHours(1), repeat: "none" });
  await deleteBot(bot.id);
  expect(await getReminder(r.id)).toBeNull();
});

test("completing marks it done", async () => {
  const bot = await createBot({ name: "Done", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Stretch", at: inHours(1), repeat: "none" });
  expect((await completeReminder(r.id))?.status).toBe("done");
});

test("publishes a reminders event on every change", async () => {
  const bot = await createBot({ name: "Loud", job: "", avatar });
  const seen: GridEvent[] = [];
  const off = subscribe((e) => seen.push(e));
  const r = await createReminder({ botId: bot.id, text: "Ping", at: inHours(1), repeat: "none" });
  await cancelReminder(r.id);
  off();
  expect(seen).toEqual([
    { type: "reminders", botId: bot.id },
    { type: "reminders", botId: bot.id },
  ]);
});
