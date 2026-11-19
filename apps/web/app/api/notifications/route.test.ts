import { DateTime } from "luxon";
import { createBot } from "@/lib/bots/repo";
import { resetDbForTests } from "@/lib/db/client";
import { notify } from "@/lib/notifications/repo";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { PATCH as patchBot } from "../bots/[id]/route";
import { GET as getSettings, PATCH as patchSettings } from "../settings/route";
import { POST as read } from "./read/route";
import { GET } from "./route";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const req = (method: string, body?: unknown, url = "http://127.0.0.1:3210/api/x") => new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("lists notifications newest first with unread counts, and marks them read", async () => {
  const a = await createBot({ name: "Inbox A", job: "", avatar });
  const b = await createBot({ name: "Inbox B", job: "", avatar });
  await notify({ botId: a.id, kind: "reminder", body: "first" });
  const second = await notify({ botId: b.id, kind: "routine", body: "second" });
  const res = await (await GET()).json();
  expect(res.notifications[0]).toMatchObject({ id: second.id, title: "Inbox B", body: "second" });
  expect(res.unread).toMatchObject({ total: 2, byBot: { [a.id]: 1, [b.id]: 1 } });

  expect(await (await read(req("POST", { botId: a.id }))).json()).toEqual({ changed: 1 });
  expect(await (await read(req("POST", { ids: [second.id] }))).json()).toEqual({ changed: 1 });
  expect((await (await GET()).json()).unread.total).toBe(0);
  expect((await read(req("POST", {}))).status).toBe(400);
});

test("mute for an hour, until tomorrow morning, for good, and unmute — without reordering the bot list", async () => {
  const bot = await createBot({ name: "Mutable", job: "", avatar });
  const mute = async (mute: unknown) => (await patchBot(req("PATCH", { mute }), ctx(bot.id))).json();

  const hour = await mute("1h");
  expect(Math.abs(new Date(hour.mutedUntil).getTime() - (Date.now() + 3_600_000))).toBeLessThan(5_000);
  expect(hour.updatedAt).toBe(bot.updatedAt);

  const tomorrow = await mute("tomorrow");
  const nine = DateTime.now().setZone("Asia/Kolkata").plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  expect(new Date(tomorrow.mutedUntil).getTime()).toBe(nine.toMillis());

  expect((await mute("forever")).mutedUntil).toMatch(/^9999-/);
  expect((await mute(null)).mutedUntil).toBeNull();
  expect((await patchBot(req("PATCH", { mute: "a while" }), ctx(bot.id))).status).toBe(400);
});

test("quiet hours and ping level are settings, checked", async () => {
  const s = (body: unknown) => patchSettings(req("PATCH", body, "http://x/api/settings"));
  expect((await s({ quietHours: { from: "22:00", to: "07:00" }, pingFor: "important" })).status).toBe(200);
  expect(await (await getSettings()).json()).toMatchObject({ quietHours: { from: "22:00", to: "07:00" }, pingFor: "important" });
  expect((await s({ quietHours: { from: "25:00", to: "07:00" } })).status).toBe(400);
  expect((await s({ pingFor: "sometimes" })).status).toBe(400);
  await s({ quietHours: null });
  expect((await (await getSettings()).json()).quietHours).toBeNull();
  // Defaults when never set.
  await setSetting("pingFor", "nonsense");
  expect((await (await getSettings()).json()).pingFor).toBe("skip-quiet");
});
