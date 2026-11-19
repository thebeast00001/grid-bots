import { DateTime } from "luxon";
import { createBot, deleteBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { subscribe, type GridEvent } from "../events";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { claimDueRoutines, createRoutine, deleteRoutine, getRoutine, listRoutines, listRuns, nextRoutineAt, setPaused, updateRoutine } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const zone = "Asia/Kolkata";
const local = (iso: string) => DateTime.fromISO(iso, { zone }).toJSDate();
const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const bot = (name: string) => createBot({ name, job: "", avatar });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

test("creates and lists a routine with its schedule in words", async () => {
  const b = await bot("Brief");
  const r = await createRoutine({ botId: b.id, name: "Morning briefing", instruction: "Give me a briefing", at: local("2026-11-20T08:00"), repeat: "weekdays" });
  expect(r).toMatchObject({ botId: b.id, name: "Morning briefing", repeat: "weekdays", status: "active", running: false, lastRunAt: null });
  expect(r.id).toMatch(/^rtn_[0-9a-f]{12}$/);
  expect(r.nextRunAt).toBe(local("2026-11-20T08:00").toISOString());
  expect(r.scheduleLabel).toBe("Weekdays at 8:00 AM");
  expect((await listRoutines(b.id)).map((x) => x.id)).toEqual([r.id]);
});

test("a one-time routine is labelled with its time", async () => {
  const b = await bot("Once");
  const r = await createRoutine({ botId: b.id, name: "Draft", instruction: "Draft the email", at: inHours(3), repeat: "none" });
  expect(r.scheduleLabel).toMatch(/^Once, (Today|Tomorrow), /);
});

test("updates, pauses and resumes", async () => {
  const b = await bot("Edit");
  const r = await createRoutine({ botId: b.id, name: "Check-in", instruction: "Ask how my day went", at: inHours(-50), repeat: "daily" });
  const renamed = await updateRoutine(r.id, { name: "Evening check-in", instruction: "Ask about my day" });
  expect(renamed).toMatchObject({ name: "Evening check-in", instruction: "Ask about my day" });
  expect((await setPaused(r.id, true))?.status).toBe("paused");
  const resumed = await setPaused(r.id, false);
  expect(resumed?.status).toBe("active");
  // Resuming moves the next run to the next future time, not the stale one.
  expect(new Date(resumed!.nextRunAt!).getTime()).toBeGreaterThan(Date.now());
});

test("refuses bad names and instructions, and a 51st routine", async () => {
  const b = await bot("Strict");
  await expect(createRoutine({ botId: b.id, name: " ", instruction: "x", at: inHours(1), repeat: "daily" })).rejects.toMatchObject({ code: "bad-name" });
  await expect(createRoutine({ botId: b.id, name: "x".repeat(61), instruction: "x", at: inHours(1), repeat: "daily" })).rejects.toMatchObject({ code: "bad-name" });
  await expect(createRoutine({ botId: b.id, name: "ok", instruction: "x".repeat(2001), at: inHours(1), repeat: "daily" })).rejects.toMatchObject({ code: "bad-instruction" });
  for (let i = 0; i < 50; i++) await createRoutine({ botId: b.id, name: `r${i}`, instruction: "x", at: inHours(1), repeat: "daily" });
  await expect(createRoutine({ botId: b.id, name: "one more", instruction: "x", at: inHours(1), repeat: "daily" })).rejects.toMatchObject({ code: "too-many" });
});

test("claims each due routine once and moves it to its next time", async () => {
  const b = await bot("Claim");
  const r = await createRoutine({ botId: b.id, name: "Daily", instruction: "x", at: local("2026-11-19T08:00"), repeat: "daily" });
  const t = local("2026-11-19T08:00:20");
  const claimed = (await Promise.all([claimDueRoutines(t), claimDueRoutines(t), claimDueRoutines(t)])).flat();
  expect(claimed.filter((c) => c.routine.id === r.id)).toHaveLength(1);
  expect(claimed.find((c) => c.routine.id === r.id)?.late).toBe(false);
  expect((await getRoutine(r.id))?.nextRunAt).toBe(local("2026-11-20T08:00").toISOString());
});

test("a routine due an hour ago is claimed late", async () => {
  const b = await bot("Late");
  const r = await createRoutine({ botId: b.id, name: "Late one", instruction: "x", at: local("2026-11-19T08:00"), repeat: "daily" });
  const claimed = await claimDueRoutines(local("2026-11-19T09:00"));
  expect(claimed.find((c) => c.routine.id === r.id)?.late).toBe(true);
});

test("a routine due two days ago is recorded as missed and moved on", async () => {
  const b = await bot("Missed");
  const r = await createRoutine({ botId: b.id, name: "Stale", instruction: "x", at: local("2026-11-17T08:00"), repeat: "daily" });
  const claimed = await claimDueRoutines(local("2026-11-19T10:00"));
  expect(claimed.find((c) => c.routine.id === r.id)).toBeUndefined();
  expect(await listRuns(r.id)).toMatchObject([{ status: "missed", trigger: "schedule", error: "Grid wasn't running at the time." }]);
  expect((await getRoutine(r.id))?.nextRunAt).toBe(local("2026-11-20T08:00").toISOString());
});

test("a one-time routine is done once claimed; paused ones are never claimed", async () => {
  const b = await bot("OneOff");
  const once = await createRoutine({ botId: b.id, name: "Once", instruction: "x", at: local("2026-11-19T08:00"), repeat: "none" });
  const paused = await createRoutine({ botId: b.id, name: "Paused", instruction: "x", at: local("2026-11-19T08:00"), repeat: "daily" });
  await setPaused(paused.id, true);
  const claimed = await claimDueRoutines(local("2026-11-19T08:01"));
  expect(claimed.map((c) => c.routine.id)).toContain(once.id);
  expect(claimed.map((c) => c.routine.id)).not.toContain(paused.id);
  expect(await getRoutine(once.id)).toMatchObject({ status: "done", nextRunAt: null });
});

test("the next routine time ignores paused and done routines", async () => {
  const b = await bot("Next");
  const soon = await createRoutine({ botId: b.id, name: "Soon", instruction: "x", at: inHours(0.5), repeat: "daily" });
  await setPaused(soon.id, true);
  const next = await nextRoutineAt();
  expect(next === null || next.getTime() !== new Date(soon.nextRunAt!).getTime()).toBe(true);
});

test("deleting the bot or the routine removes it", async () => {
  const b = await bot("Gone");
  const r = await createRoutine({ botId: b.id, name: "Bye", instruction: "x", at: inHours(1), repeat: "daily" });
  const r2 = await createRoutine({ botId: b.id, name: "Bye 2", instruction: "x", at: inHours(1), repeat: "daily" });
  expect(await deleteRoutine(r2.id)).toBe(true);
  expect(await getRoutine(r2.id)).toBeNull();
  await deleteBot(b.id);
  expect(await getRoutine(r.id)).toBeNull();
});

test("publishes a routines event on every change", async () => {
  const b = await bot("Loud");
  const seen: GridEvent[] = [];
  const off = subscribe((e) => seen.push(e));
  const r = await createRoutine({ botId: b.id, name: "Ping", instruction: "x", at: inHours(1), repeat: "daily" });
  await setPaused(r.id, true);
  off();
  expect(seen).toEqual([
    { type: "routines", botId: b.id },
    { type: "routines", botId: b.id },
  ]);
});
