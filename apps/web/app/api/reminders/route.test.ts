import { createBot } from "@/lib/bots/repo";
import { loadThread } from "@/lib/chat/history";
import { resetDbForTests } from "@/lib/db/client";
import { publish } from "@/lib/events";
import { deliverDue } from "@/lib/reminders/deliver";
import { createReminder } from "@/lib/reminders/repo";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { GET as events } from "../events/route";
import { GET as getSettings, PATCH as patchSettings } from "../settings/route";
import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const req = (method: string, body?: unknown, url = "http://127.0.0.1:3210/api/reminders") =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

test("creates from words and lists upcoming", async () => {
  const bot = await createBot({ name: "Api", job: "", avatar });
  const res = await POST(req("POST", { botId: bot.id, text: "Pay rent", when: "in 2 hours" }));
  expect(res.status).toBe(201);
  const r = await res.json();
  expect(r).toMatchObject({ botId: bot.id, text: "Pay rent", repeat: "none", status: "scheduled" });
  expect(Math.abs(new Date(r.dueAt).getTime() - (Date.now() + 2 * 3_600_000))).toBeLessThan(5_000);

  const list = await (await GET(req("GET", undefined, `http://x/api/reminders?botId=${bot.id}&upcoming=1`))).json();
  expect(list.reminders.map((x: { id: string }) => x.id)).toEqual([r.id]);
});

test("takes the repeat from the words", async () => {
  const bot = await createBot({ name: "Rep", job: "", avatar });
  const r = await (await POST(req("POST", { botId: bot.id, text: "Vitamins", when: "every day at 9am" }))).json();
  expect(r.repeat).toBe("daily");
});

test("refuses past and unclear times with typed errors", async () => {
  const bot = await createBot({ name: "Picky", job: "", avatar });
  const past = await POST(req("POST", { botId: bot.id, text: "x", when: "yesterday at 9am" }));
  expect(past.status).toBe(400);
  expect(await errorCode(past)).toBe("past-time");
  const unclear = await POST(req("POST", { botId: bot.id, text: "x", when: "purple" }));
  expect(await errorCode(unclear)).toBe("unclear-time");
  expect((await POST(req("POST", { botId: "bot_missing", text: "x", when: "in 1 hour" }))).status).toBe(404);
});

test("changes text and time from words", async () => {
  const bot = await createBot({ name: "Change", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Call mom", at: new Date(Date.now() + 3_600_000), repeat: "none" });
  const res = await PATCH(req("PATCH", { text: "Call mom back", when: "in 3 hours" }), ctx(r.id));
  const changed = await res.json();
  expect(changed.text).toBe("Call mom back");
  expect(Math.abs(new Date(changed.dueAt).getTime() - (Date.now() + 3 * 3_600_000))).toBeLessThan(5_000);
});

test("snooze, done and cancel", async () => {
  const bot = await createBot({ name: "Act", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Stretch", at: new Date(Date.now() + 60_000), repeat: "none" });
  const snoozed = await (await PATCH(req("PATCH", { action: "snooze", preset: "1h" }), ctx(r.id))).json();
  expect(Math.abs(new Date(snoozed.dueAt).getTime() - (Date.now() + 3_600_000))).toBeLessThan(5_000);
  expect((await (await PATCH(req("PATCH", { action: "done" }), ctx(r.id))).json()).status).toBe("done");
  expect((await DELETE(req("DELETE"), ctx(r.id))).status).toBe(204);
  expect((await PATCH(req("PATCH", { action: "done" }), ctx("rem_000000000000"))).status).toBe(404);
});

test("done and snooze record the occurrence on the delivered message", async () => {
  const bot = await createBot({ name: "Occur", job: "", avatar });
  const r = await createReminder({ botId: bot.id, text: "Pills", at: new Date(Date.now() - 1_000), repeat: "daily" });
  await deliverDue(new Date());
  const [msg] = await loadThread(bot.id);
  await PATCH(req("PATCH", { action: "snooze", preset: "10m", messageId: msg.id }), ctx(r.id));
  const [after] = await loadThread(bot.id);
  expect(after.metadata).toMatchObject({ reminderId: r.id, reminder: { state: "snoozed" } });

  // A message from a different reminder is left alone.
  const other = await createReminder({ botId: bot.id, text: "Other", at: new Date(Date.now() + 60_000), repeat: "none" });
  await PATCH(req("PATCH", { action: "done", messageId: msg.id }), ctx(other.id));
  expect((await loadThread(bot.id))[0].metadata).toMatchObject({ reminder: { state: "snoozed" } });
});

test("the timezone setting accepts only real zones", async () => {
  const bad = await patchSettings(req("PATCH", { timezone: "Mars/Base" }, "http://x/api/settings"));
  expect(bad.status).toBe(400);
  const ok = await patchSettings(req("PATCH", { timezone: "Europe/London" }, "http://x/api/settings"));
  expect(ok.status).toBe(200);
  expect((await (await getSettings()).json()).timezone).toBe("Europe/London");
  await setSetting("timezone", "Asia/Kolkata");
});

test("events stream as server-sent events until the client goes away", async () => {
  const abort = new AbortController();
  const res = await events(new Request("http://127.0.0.1:3210/api/events", { signal: abort.signal }));
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  expect(res.headers.get("cache-control")).toContain("no-transform");
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  publish({ type: "reminders", botId: "bot_x" });
  let text = "";
  while (!text.includes("data:")) text += decoder.decode((await reader.read()).value);
  expect(text).toContain(`data: {"type":"reminders","botId":"bot_x"}\n\n`);
  abort.abort();
  await reader.cancel().catch(() => {});
});
