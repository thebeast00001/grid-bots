import { eq } from "drizzle-orm";
import { createBot, deleteBot } from "../bots/repo";
import { getDb, resetDbForTests } from "../db/client";
import { bots, notifications } from "../db/schema";
import { subscribe, type GridEvent } from "../events";
import { addProvider } from "../models/providers-repo";
import { deliverDue } from "../reminders/deliver";
import { createReminder } from "../reminders/repo";
import { createRoutine } from "../routines/repo";
import { runRoutine } from "../routines/run";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { listNotifications, markRead, notify, unreadCounts } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const bot = (name: string) => createBot({ name, job: "", avatar });

test("notify records it, decides whether it pings, and tells the app", async () => {
  const b = await bot("Notifier");
  const seen: GridEvent[] = [];
  const off = subscribe((e) => seen.push(e));
  const n = await notify({ botId: b.id, kind: "reminder", body: "Pay rent", messageId: "msg_1" });
  off();
  expect(n).toMatchObject({ botId: b.id, kind: "reminder", title: "Notifier", body: "Pay rent", messageId: "msg_1", importance: "normal", ping: true, reason: null, readAt: null });
  expect(n.id).toMatch(/^ntf_[0-9a-f]{12}$/);
  expect(seen).toContainEqual({ type: "notification", notification: n });
});

test("a muted bot's reminder is recorded but doesn't ping", async () => {
  const b = await bot("Hush");
  const db = await getDb();
  await db.update(bots).set({ mutedUntil: new Date(Date.now() + 3_600_000).toISOString() }).where(eq(bots.id, b.id));
  expect(await notify({ botId: b.id, kind: "reminder", body: "Quiet one" })).toMatchObject({ ping: false, reason: "muted" });
});

test("unread counts per bot, and marking read by bot or all", async () => {
  const a = await bot("CountA");
  const c = await bot("CountB");
  await notify({ botId: a.id, kind: "reminder", body: "1" });
  await notify({ botId: a.id, kind: "reminder", body: "2" });
  await notify({ botId: c.id, kind: "routine", body: "3" });
  const counts = await unreadCounts();
  expect(counts.byBot[a.id]).toBe(2);
  expect(counts.byBot[c.id]).toBe(1);
  expect(await markRead({ botId: a.id })).toBe(2);
  expect((await unreadCounts()).byBot[a.id]).toBeUndefined();
  await markRead({ all: true });
  expect((await unreadCounts()).total).toBe(0);
});

test("lists newest first and keeps only the newest 500", async () => {
  const b = await bot("Flood");
  const db = await getDb();
  const rows = Array.from({ length: 505 }, (_, i) => ({
    id: `ntf_${i.toString(16).padStart(12, "0")}`,
    botId: b.id,
    kind: "routine" as const,
    title: "Flood",
    body: `n${i}`,
    importance: "normal" as const,
    ping: false,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
  }));
  await db.insert(notifications).values(rows);
  const latest = await notify({ botId: b.id, kind: "routine", body: "newest" });
  const list = await listNotifications(1000);
  expect(list).toHaveLength(500);
  expect(list[0].id).toBe(latest.id);
  expect(list.some((n) => n.body === "n0")).toBe(false);
});

test("deleting a bot removes its notifications", async () => {
  const b = await bot("Gone");
  const n = await notify({ botId: b.id, kind: "reminder", body: "bye" });
  await deleteBot(b.id);
  expect((await listNotifications(1000)).some((x) => x.id === n.id)).toBe(false);
});

test("reminders and routines land in the inbox with their message", async () => {
  const p = await addProvider({ kind: "mock" });
  await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
  const b = await bot("Both");
  await createReminder({ botId: b.id, text: "Stretch", at: new Date(Date.now() - 1000), repeat: "none" });
  await deliverDue(new Date());
  const r = await createRoutine({ botId: b.id, name: "Briefing", instruction: "Say hi", at: new Date(Date.now() + 3_600_000), repeat: "daily" });
  const run = await runRoutine(r.id, "manual");
  const mine = (await listNotifications(1000)).filter((n) => n.botId === b.id);
  expect(mine.map((n) => [n.kind, n.body])).toEqual([
    ["routine", "Briefing"],
    ["reminder", "Stretch"],
  ]);
  expect(mine[0].messageId).toBe(run.messageId);
});
