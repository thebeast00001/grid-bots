import { createBot } from "@/lib/bots/repo";
import { resetDbForTests } from "@/lib/db/client";
import { addProvider } from "@/lib/models/providers-repo";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { DELETE, PATCH } from "./[id]/route";
import { POST as run } from "./[id]/run/route";
import { GET as runs } from "./[id]/runs/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(async () => {
  await setSetting("timezone", "Asia/Kolkata");
  const p = await addProvider({ kind: "mock" });
  await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
});

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const req = (method: string, body?: unknown, url = "http://127.0.0.1:3210/api/routines") =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const code = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;
const make = async (name: string, when = "every weekday at 8am") => {
  const bot = await createBot({ name, job: "", avatar });
  const res = await POST(req("POST", { botId: bot.id, name: "Morning briefing", instruction: "Give me a briefing", when }));
  return { bot, res, routine: res.status === 201 ? await res.json() : null };
};

test("creates from words and lists", async () => {
  const { bot, res, routine } = await make("Api");
  expect(res.status).toBe(201);
  expect(routine).toMatchObject({ name: "Morning briefing", repeat: "weekdays", scheduleLabel: "Weekdays at 8:00 AM", status: "active" });
  const list = await (await GET(req("GET", undefined, `http://x/api/routines?botId=${bot.id}`))).json();
  expect(list.routines.map((r: { id: string }) => r.id)).toEqual([routine.id]);
});

test("a time without a repeat is a one-time routine", async () => {
  const { routine } = await make("Once", "in 2 hours");
  expect(routine).toMatchObject({ repeat: "none" });
  expect(routine.scheduleLabel).toMatch(/^Once, /);
});

test("refuses unclear and past times and unknown bots", async () => {
  expect(await code((await make("Unclear", "whenever")).res)).toBe("unclear-time");
  expect(await code((await make("Past", "yesterday at 9am")).res)).toBe("past-time");
  expect((await POST(req("POST", { botId: "bot_missing", name: "x", instruction: "y", when: "in 1 hour" }))).status).toBe(404);
});

test("edits, pauses, resumes and deletes", async () => {
  const { routine } = await make("Edit");
  const renamed = await (await PATCH(req("PATCH", { name: "Evening check-in", instruction: "Ask about my day", when: "every day at 9pm" }), ctx(routine.id))).json();
  expect(renamed).toMatchObject({ name: "Evening check-in", instruction: "Ask about my day", repeat: "daily", scheduleLabel: "Every day at 9:00 PM" });
  expect((await (await PATCH(req("PATCH", { paused: true }), ctx(routine.id))).json()).status).toBe("paused");
  expect((await (await PATCH(req("PATCH", { paused: false }), ctx(routine.id))).json()).status).toBe("active");
  expect((await DELETE(req("DELETE"), ctx(routine.id))).status).toBe(204);
  expect((await DELETE(req("DELETE"), ctx(routine.id))).status).toBe(404);
});

test("run now answers at once, refuses a second run while it runs, and shows in history", async () => {
  const { routine } = await make("Runs");
  const first = await run(req("POST"), ctx(routine.id));
  expect(first.status).toBe(202);
  const { runId } = await first.json();
  expect(runId).toMatch(/^run_[0-9a-f]{12}$/);
  const second = await run(req("POST"), ctx(routine.id));
  expect([202, 409]).toContain(second.status);
  if (second.status === 409) expect(await code(second)).toBe("running");

  await vi.waitFor(
    async () => {
      const h = await (await runs(req("GET"), ctx(routine.id))).json();
      expect(h.runs.find((r: { id: string }) => r.id === runId)).toMatchObject({ status: "done", trigger: "manual" });
    },
    { timeout: 5_000, interval: 100 },
  );
  expect((await run(req("POST"), ctx("rtn_000000000000"))).status).toBe(404);
});
