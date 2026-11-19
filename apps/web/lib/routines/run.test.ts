import type { UIMessage } from "ai";
import { createBot, deleteBot } from "../bots/repo";
import { loadThread } from "../chat/history";
import { resetDbForTests } from "../db/client";
import { subscribe, type GridEvent } from "../events";
import { addProvider } from "../models/providers-repo";
import { startScheduler, stopScheduler } from "../scheduler";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { createRoutine, getRoutine, listRuns } from "./repo";
import { routinePrompt, runRoutine } from "./run";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);
const routineFor = async (name: string, instruction = "Give me a briefing") => {
  const bot = await createBot({ name, job: "", avatar });
  const routine = await createRoutine({ botId: bot.id, name: "Morning briefing", instruction, at: inHours(20), repeat: "weekdays" });
  return { bot, routine };
};
const routinePart = (m: UIMessage) => m.parts.find((p) => p.type === "data-routine") as { data: Record<string, unknown> } | undefined;

let connected = false;
async function connectMock() {
  if (connected) return;
  const p = await addProvider({ kind: "mock" });
  await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
  connected = true;
}

// Runs first, before any model is connected.
test("a run without a model fails visibly", async () => {
  const { bot, routine } = await routineFor("NoModel");
  const run = await runRoutine(routine.id, "manual");
  expect(run).toMatchObject({ status: "failed", error: "Connect a model to start chatting." });
  const [msg] = await loadThread(bot.id);
  expect(routinePart(msg)?.data).toMatchObject({ routineId: routine.id, runId: run.id, name: "Morning briefing", status: "failed", error: "Connect a model to start chatting." });
});

test("a run posts the result into the chat", async () => {
  await connectMock();
  const { bot, routine } = await routineFor("Runner");
  const run = await runRoutine(routine.id, "manual");
  expect(run).toMatchObject({ status: "done", trigger: "manual", late: false });
  const thread = await loadThread(bot.id);
  expect(thread).toHaveLength(1);
  expect(thread[0]).toMatchObject({ id: run.messageId, role: "assistant", metadata: { routineId: routine.id, runId: run.id } });
  expect(routinePart(thread[0])?.data).toMatchObject({ routineId: routine.id, runId: run.id, name: "Morning briefing", status: "done", late: false });
  expect(JSON.stringify(thread[0].parts)).toContain("Routine result: Give me a briefing");
  expect((await getRoutine(routine.id))?.lastRunAt).not.toBeNull();
  expect(await listRuns(routine.id)).toMatchObject([{ id: run.id, status: "done" }]);
});

test("the run prompt names the routine, its schedule and the job", () => {
  expect(routinePrompt({ name: "Morning briefing", instruction: "Give me a briefing" }, "Weekdays at 8:00 AM")).toBe(
    '[[routine]] It\'s time for your routine "Morning briefing" (Weekdays at 8:00 AM). The user set it up to run on its own and isn\'t here right now. Do this: Give me a briefing\nReply with just the result, written for the user to read later.',
  );
});

test("a late run is marked late", async () => {
  await connectMock();
  const { bot, routine } = await routineFor("Lately");
  await runRoutine(routine.id, "schedule", { late: true });
  const [msg] = await loadThread(bot.id);
  expect(routinePart(msg)?.data).toMatchObject({ late: true });
});

test("a second run while one is running is refused", async () => {
  await connectMock();
  const { routine } = await routineFor("Twice");
  const results = await Promise.allSettled([runRoutine(routine.id, "manual"), runRoutine(routine.id, "manual")]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "running" } });
});

test("deleting the bot mid-run doesn't crash", async () => {
  await connectMock();
  const { bot, routine } = await routineFor("Vanish");
  const started = new Promise<void>((resolve) => {
    const off = subscribe((e) => {
      if (e.type === "run" && e.routineId === routine.id && e.status === "running") {
        off();
        resolve();
      }
    });
  });
  const run = runRoutine(routine.id, "manual");
  await started;
  await deleteBot(bot.id);
  await expect(run).resolves.toBeTruthy();
});

test("a routine deleted just as its run starts is reported as not found, not as already running", async () => {
  await connectMock();
  const { bot, routine } = await routineFor("Race");
  // Handle the outcome straight away so a quick rejection isn't reported as unhandled.
  const outcome = runRoutine(routine.id, "manual").then(
    () => "ran",
    (e: { code?: string }) => e.code,
  );
  await deleteBot(bot.id);
  expect(["ran", "not-found"]).toContain(await outcome);
});

test("runs publish running, then the message, then done", async () => {
  await connectMock();
  const { bot, routine } = await routineFor("Herald");
  const seen: GridEvent[] = [];
  const off = subscribe((e) => e.type !== "routines" && seen.push(e));
  const run = await runRoutine(routine.id, "manual");
  off();
  expect(seen.map((e) => (e.type === "run" ? `run:${e.status}` : e.type))).toEqual(["run:running", "message", "run:done"]);
  expect(seen[1]).toMatchObject({ type: "message", botId: bot.id, messageId: run.messageId, title: "Herald", body: "Morning briefing" });
});

test("the scheduler starts due routines", async () => {
  await connectMock();
  const bot = await createBot({ name: "Clockwork", job: "", avatar });
  await createRoutine({ botId: bot.id, name: "Soon", instruction: "Say hi", at: new Date(Date.now() + 400), repeat: "daily" });
  startScheduler();
  try {
    await vi.waitFor(async () => expect(await loadThread(bot.id)).toHaveLength(1), { timeout: 5_000, interval: 100 });
  } finally {
    stopScheduler();
  }
});
