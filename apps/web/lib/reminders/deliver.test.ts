import { DateTime } from "luxon";
import { createBot } from "../bots/repo";
import { loadThread } from "../chat/history";
import { resetDbForTests } from "../db/client";
import { subscribe, type GridEvent } from "../events";
import { startScheduler, stopScheduler } from "../scheduler";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { deliverDue } from "./deliver";
import { createReminder, getReminder, snoozeReminder } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const zone = "Asia/Kolkata";
const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const local = (iso: string) => DateTime.fromISO(iso, { zone }).toJSDate();
const bot = (name: string) => createBot({ name, job: "", avatar });

test("writes the reminder into the chat with a data-reminder part", async () => {
  const b = await bot("Ring");
  const due = local("2026-11-19T18:00");
  const r = await createReminder({ botId: b.id, text: "Pay rent", at: due, repeat: "none" });
  expect(await deliverDue(local("2026-11-19T18:00:30"))).toBe(1);

  const thread = await loadThread(b.id);
  expect(thread).toHaveLength(1);
  expect(thread[0]).toMatchObject({
    role: "assistant",
    parts: [
      { type: "text", text: "⏰ Pay rent" },
      { type: "data-reminder", data: { reminderId: r.id, text: "Pay rent", dueAt: due.toISOString(), late: false } },
    ],
  });
  expect(await getReminder(r.id)).toMatchObject({ status: "fired", firedAt: local("2026-11-19T18:00:30").toISOString() });
});

test("claims each due reminder once", async () => {
  const b = await bot("Once");
  await createReminder({ botId: b.id, text: "Only once", at: local("2026-11-19T18:00"), repeat: "none" });
  const t = local("2026-11-19T18:01");
  const counts = await Promise.all([deliverDue(t), deliverDue(t), deliverDue(t)]);
  expect(counts.reduce((a, n) => a + n, 0)).toBe(1);
  expect(await loadThread(b.id)).toHaveLength(1);
});

test("leaves reminders that aren't due yet", async () => {
  const b = await bot("Wait");
  const r = await createReminder({ botId: b.id, text: "Later", at: local("2026-11-19T20:00"), repeat: "none" });
  await deliverDue(local("2026-11-19T19:59"));
  expect((await getReminder(r.id))?.status).toBe("scheduled");
  expect(await loadThread(b.id)).toHaveLength(0);
});

test("delivers missed reminders once, marked late", async () => {
  const b = await bot("Late");
  const r = await createReminder({ botId: b.id, text: "Vitamins", at: local("2026-11-16T09:00"), repeat: "daily" });
  // Grid was off for three days.
  await deliverDue(local("2026-11-19T10:00"));
  const thread = await loadThread(b.id);
  expect(thread).toHaveLength(1);
  expect(thread[0].parts[1]).toMatchObject({ type: "data-reminder", data: { late: true, dueAt: local("2026-11-16T09:00").toISOString() } });
  expect(await getReminder(r.id)).toMatchObject({ status: "scheduled", dueAt: local("2026-11-20T09:00").toISOString() });
});

test("snooze moves a fired reminder back to scheduled", async () => {
  const b = await bot("Snooze");
  const r = await createReminder({ botId: b.id, text: "Water plants", at: local("2026-11-19T18:00"), repeat: "none" });
  await deliverDue(local("2026-11-19T18:10"));
  const until = local("2026-11-19T18:20");
  expect(await snoozeReminder(r.id, until)).toMatchObject({ status: "scheduled", dueAt: until.toISOString(), late: false });
});

test("publishes a message event with the bot's name", async () => {
  const b = await bot("Herald");
  await createReminder({ botId: b.id, text: "Stand up", at: local("2026-11-19T18:00"), repeat: "none" });
  const seen: GridEvent[] = [];
  const off = subscribe((e) => seen.push(e));
  await deliverDue(local("2026-11-19T18:00:05"));
  off();
  const [msg] = await loadThread(b.id);
  expect(seen).toContainEqual({ type: "message", botId: b.id, messageId: msg.id, title: "Herald", body: "Stand up" });
});

test("the scheduler delivers a reminder on time", async () => {
  const b = await bot("Clock");
  await createReminder({ botId: b.id, text: "Now-ish", at: new Date(Date.now() + 400), repeat: "none" });
  startScheduler();
  try {
    await vi.waitFor(async () => expect(await loadThread(b.id)).toHaveLength(1), { timeout: 3_000, interval: 100 });
  } finally {
    stopScheduler();
  }
});
