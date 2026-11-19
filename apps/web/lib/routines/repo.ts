import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, lte, min } from "drizzle-orm";
import type { RoutineView, RunView } from "../client-types";
import { getDb } from "../db/client";
import { routineRuns, routines, type RoutineRow, type RunRow } from "../db/schema";
import { publish } from "../events";
import { HttpStatus } from "../http";
import { formatWhen, nextOccurrence, repeatLabel, type Repeat } from "../reminders/when";
import { userZone } from "../settings";

export const MAX_ROUTINES = 50;
export const MAX_NAME = 60;
export const MAX_INSTRUCTION = 2000;
/** Missed by more than this while Grid was off: skip it rather than run with stale context. */
export const MISSED_AFTER_MS = 12 * 3_600_000;
const LATE_MS = 2 * 60_000;

const hex = () => randomBytes(6).toString("hex");

export function scheduleLabel(r: Pick<RoutineRow, "repeat" | "anchorAt">, zone: string, now = new Date()): string {
  return repeatLabel(r.repeat, r.anchorAt, zone) ?? `Once, ${formatWhen(r.anchorAt, { now, zone })}`;
}

async function toViews(rows: RoutineRow[]): Promise<RoutineView[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const zone = await userZone();
  const running = new Set(
    (
      await db
        .select({ id: routineRuns.routineId })
        .from(routineRuns)
        .where(and(eq(routineRuns.status, "running"), inArray(routineRuns.routineId, rows.map((r) => r.id))))
    ).map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    botId: r.botId,
    name: r.name,
    instruction: r.instruction,
    repeat: r.repeat,
    status: r.status,
    nextRunAt: r.nextRunAt?.toISOString() ?? null,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    scheduleLabel: scheduleLabel(r, zone),
    running: running.has(r.id),
  }));
}
const toView = async (r: RoutineRow) => (await toViews([r]))[0];

export const toRunView = (r: RunRow): RunView => ({
  id: r.id,
  routineId: r.routineId,
  trigger: r.trigger,
  status: r.status,
  startedAt: r.startedAt.toISOString(),
  finishedAt: r.finishedAt?.toISOString() ?? null,
  messageId: r.messageId,
  error: r.error,
  late: r.late,
});

function clean(name: string | undefined, instruction: string | undefined) {
  const out: { name?: string; instruction?: string } = {};
  if (name !== undefined) {
    const n = name.trim();
    if (!n || n.length > MAX_NAME) throw new HttpStatus(400, "bad-name", `A routine's name needs 1–${MAX_NAME} characters.`);
    out.name = n;
  }
  if (instruction !== undefined) {
    const i = instruction.trim();
    if (!i || i.length > MAX_INSTRUCTION) throw new HttpStatus(400, "bad-instruction", `Say what to do in 1–${MAX_INSTRUCTION} characters.`);
    out.instruction = i;
  }
  return out;
}

async function change(id: string, set: Partial<RoutineRow>): Promise<RoutineView | null> {
  const db = await getDb();
  const [row] = await db.update(routines).set(set).where(eq(routines.id, id)).returning();
  if (!row) return null;
  publish({ type: "routines", botId: row.botId });
  return toView(row);
}

export async function createRoutine(input: { botId: string; name: string; instruction: string; at: Date; repeat: Repeat }): Promise<RoutineView> {
  const { name, instruction } = clean(input.name, input.instruction) as { name: string; instruction: string };
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(routines).where(eq(routines.botId, input.botId));
  if (n >= MAX_ROUTINES) throw new HttpStatus(409, "too-many", `This bot already has ${MAX_ROUTINES} routines. Delete some first.`);
  const [row] = await db
    .insert(routines)
    .values({ id: `rtn_${hex()}`, botId: input.botId, name, instruction, anchorAt: input.at, nextRunAt: input.at, repeat: input.repeat })
    .returning();
  publish({ type: "routines", botId: row.botId });
  return toView(row);
}

/** A bot's routines: active ones soonest first, then paused, then done. */
export async function listRoutines(botId: string): Promise<RoutineView[]> {
  const db = await getDb();
  const rows = await db.select().from(routines).where(eq(routines.botId, botId)).orderBy(asc(routines.nextRunAt), asc(routines.createdAt));
  const rank = { active: 0, paused: 1, done: 2 } as const;
  return toViews(rows.sort((a, b) => rank[a.status] - rank[b.status]));
}

export async function getRoutine(id: string): Promise<RoutineView | null> {
  const row = await getRoutineRow(id);
  return row ? toView(row) : null;
}

export async function getRoutineRow(id: string): Promise<RoutineRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(routines).where(eq(routines.id, id));
  return row ?? null;
}

/** A new time restarts the schedule from that time (and revives a finished one-time routine). */
export async function updateRoutine(id: string, p: { name?: string; instruction?: string; at?: Date; repeat?: Repeat }): Promise<RoutineView | null> {
  const set: Partial<RoutineRow> = { ...clean(p.name, p.instruction) };
  if (p.repeat !== undefined) set.repeat = p.repeat;
  if (p.at) Object.assign(set, { anchorAt: p.at, nextRunAt: p.at });
  const current = await getRoutineRow(id);
  if (current?.status === "done" && p.at) set.status = "active";
  return change(id, set);
}

/** Pausing keeps everything; resuming picks the next time that is still ahead. */
export async function setPaused(id: string, paused: boolean): Promise<RoutineView | null> {
  const r = await getRoutineRow(id);
  if (!r || r.status === "done") return r ? toView(r) : null;
  if (paused) return change(id, { status: "paused" });
  const now = new Date();
  const next = r.anchorAt > now ? r.anchorAt : nextOccurrence(r.anchorAt, r.repeat, now, await userZone());
  return change(id, next ? { status: "active", nextRunAt: next } : { status: "done", nextRunAt: null });
}

export async function deleteRoutine(id: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.delete(routines).where(eq(routines.id, id)).returning();
  if (row) publish({ type: "routines", botId: row.botId });
  return !!row;
}

export async function listRuns(routineId: string, limit = 10): Promise<RunView[]> {
  const db = await getDb();
  const rows = await db.select().from(routineRuns).where(eq(routineRuns.routineId, routineId)).orderBy(desc(routineRuns.startedAt)).limit(limit);
  return rows.map(toRunView);
}

export async function nextRoutineAt(): Promise<Date | null> {
  const db = await getDb();
  const [{ at }] = await db.select({ at: min(routines.nextRunAt) }).from(routines).where(eq(routines.status, "active"));
  return at ?? null;
}

/**
 * Takes every active routine due by `now` and moves it to its next time, each with a
 * compare-and-set on its old time so overlapping calls never take the same one twice.
 * Ones missed by more than 12 hours (Grid was off) get a "missed" run instead.
 */
export async function claimDueRoutines(now: Date): Promise<{ routine: RoutineRow; late: boolean }[]> {
  const db = await getDb();
  const due = await db
    .select()
    .from(routines)
    .where(and(eq(routines.status, "active"), lte(routines.nextRunAt, now)));
  if (due.length === 0) return [];
  const zone = await userZone();
  const out: { routine: RoutineRow; late: boolean }[] = [];
  for (const r of due) {
    const was = r.nextRunAt!;
    const next = nextOccurrence(r.anchorAt, r.repeat, now, zone);
    const [claimed] = await db
      .update(routines)
      .set(next ? { nextRunAt: next } : { nextRunAt: null, status: "done" })
      .where(and(eq(routines.id, r.id), eq(routines.status, "active"), eq(routines.nextRunAt, was)))
      .returning();
    if (!claimed) continue;
    publish({ type: "routines", botId: r.botId });
    const behind = now.getTime() - was.getTime();
    if (behind > MISSED_AFTER_MS) {
      await db.insert(routineRuns).values({
        id: `run_${hex()}`,
        routineId: r.id,
        botId: r.botId,
        trigger: "schedule",
        status: "missed",
        startedAt: was,
        finishedAt: now,
        error: "Grid wasn't running at the time.",
      });
      continue;
    }
    out.push({ routine: claimed, late: behind > LATE_MS });
  }
  return out;
}
