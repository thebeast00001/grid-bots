import { randomBytes } from "node:crypto";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { getBot, touchBot } from "../bots/repo";
import { inlineFileParts } from "../chat/files";
import { compactForStorage, forModel, loadThread, textOf, trimHistory } from "../chat/history";
import { buildInstructions } from "../chat/instructions";
import { makeTools, type Rating } from "../chat/tools";
import { chatUIStream } from "../chat/ui-stream";
import type { RunView } from "../client-types";
import { getDb } from "../db/client";
import { messages, routineRuns, routines, type RoutineRow } from "../db/schema";
import { publish } from "../events";
import { notify } from "../notifications/repo";
import { HttpStatus, notFound } from "../http";
import { listMemories } from "../memory/repo";
import { toGridError, type GridModelError } from "../models/errors";
import { resolveModel } from "../models/resolve";
import { userZone } from "../settings";
import { claimDueRoutines, getRoutineRow, scheduleLabel, toRunView } from "./repo";
import { makeWebTools } from "../web/tools";

/** A run that hasn't finished by then is abandoned. */
export const RUN_TIMEOUT_MS = 3 * 60_000;
/** How much of the chat a run sees. */
const HISTORY = 20;

export type RoutinePart = {
  type: "data-routine";
  data: { routineId: string; runId: string; name: string; status: "done" | "failed"; error?: string; action?: { label: string; href: string }; late: boolean; at: string };
};

/** What the bot is told when its routine comes round (never stored in the chat). */
export function routinePrompt(r: Pick<RoutineRow, "name" | "instruction">, schedule: string): string {
  return `[[routine]] It's time for your routine "${r.name}" (${schedule}). The user set it up to run on its own and isn't here right now. Do this: ${r.instruction}\nReply with just the result, written for the user to read later. Then use rate_result to say how much it needs their attention.`;
}

const hex = (n: number) => randomBytes(n).toString("hex");

/** The Postgres error code (e.g. "23505") from an error or anything it wraps. */
function pgCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

async function drain(stream: ReadableStream<unknown>) {
  const reader = stream.getReader();
  try {
    for (;;) if ((await reader.read()).done) return;
  } catch {
    // Reported through onError.
  }
}

/** Does the routine's job with the bot's model, instructions and tools. Throws on failure. */
async function work(r: RoutineRow, runId: string, messageId: string, onRate: (x: Rating) => void): Promise<UIMessage> {
  const bot = await getBot(r.botId);
  if (!bot) throw notFound("Bot");
  const resolved = await resolveModel(bot.model);
  const zone = await userZone();
  const [botMemories, userMemories, thread] = await Promise.all([listMemories(bot.id), listMemories(null), loadThread(bot.id)]);
  const history = trimHistory(thread.slice(-HISTORY));
  const prompt: UIMessage = { id: `prompt_${runId}`, role: "user", parts: [{ type: "text", text: routinePrompt(r, scheduleLabel(r, zone)) }] };
  const instructions = buildInstructions({ bot, zone, botMemories, userMemories, now: new Date(), interview: { pending: false, answered: 0 }, tools: resolved.tools, search: resolved.search });
  const convo = [...history, prompt];
  const tools = resolved.tools
    ? { ...makeTools({ botId: bot.id, zone, onRate }), ...makeWebTools({ thread: convo, search: resolved.search }), ...(resolved.searchTool ? { web_search: resolved.searchTool } : {}) }
    : undefined;
  const modelMessages = await convertToModelMessages(await inlineFileParts(forModel(convo)), { tools });

  const result = streamText({
    model: resolved.model,
    instructions,
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(8),
    abortSignal: AbortSignal.timeout(RUN_TIMEOUT_MS),
  });
  let failure: unknown;
  const reply = await new Promise<UIMessage | undefined>((resolve) => {
    void drain(
      chatUIStream({
        stream: result.stream,
        tools,
        originalMessages: [],
        messageId,
        onError: (e) => {
          failure = e;
          return "error";
        },
        onEnd: ({ messages: all }) => resolve(all.at(-1)),
      }),
    ).then(() => resolve(undefined));
  });
  if (failure) throw failure;
  if (!reply || reply.role !== "assistant" || !textOf(reply)) throw new Error("The bot didn't write anything.");
  return reply;
}

function failureOf(e: unknown): { error: string; action?: { label: string; href: string } } {
  if (e instanceof Error && e.name === "TimeoutError") return { error: "Took too long (over 3 minutes)." };
  const g: GridModelError = toGridError(e);
  return { error: g.message, action: g.action };
}

/**
 * Starts a routine now: records the run and returns its id at once; `done` resolves when
 * the work is finished and the result (or why it couldn't run) is in the bot's chat.
 * Throws only if the routine is missing (404) or already running (409); `done` never rejects.
 */
export async function startRun(routineId: string, trigger: "schedule" | "manual", opts: { late?: boolean } = {}): Promise<{ runId: string; done: Promise<RunView> }> {
  const r = await getRoutineRow(routineId);
  if (!r) throw notFound("Routine");
  const db = await getDb();
  const runId = `run_${hex(6)}`;
  const startedAt = new Date();
  try {
    await db.insert(routineRuns).values({ id: runId, routineId: r.id, botId: r.botId, trigger, status: "running", startedAt, late: !!opts.late });
  } catch (e) {
    const code = pgCode(e);
    // unique_violation: the one-running-run index; foreign_key_violation: the routine was just deleted.
    if (code === "23505") throw new HttpStatus(409, "running", "This routine is already running.");
    if (code === "23503") throw notFound("Routine");
    throw e;
  }
  await db.update(routines).set({ lastRunAt: startedAt }).where(eq(routines.id, r.id));
  publish({ type: "routines", botId: r.botId });
  publish({ type: "run", botId: r.botId, routineId: r.id, runId, name: r.name, status: "running" });
  return { runId, done: finish(r, runId, startedAt, trigger, !!opts.late) };
}

/** Runs a routine and waits for it to finish (see startRun). */
export async function runRoutine(routineId: string, trigger: "schedule" | "manual", opts: { late?: boolean } = {}): Promise<RunView> {
  return (await startRun(routineId, trigger, opts)).done;
}

async function finish(r: RoutineRow, runId: string, startedAt: Date, trigger: "schedule" | "manual", late: boolean): Promise<RunView> {
  const fallback = (status: "done" | "failed", error: string | null): RunView => ({
    id: runId,
    routineId: r.id,
    trigger,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    messageId: null,
    error,
    late,
  });
  try {
    return await finishRun(r, runId, late, fallback);
  } catch (e) {
    console.error(`[grid] routine ${r.id} run ${runId}:`, e);
    return fallback("failed", "Something went wrong saving this run.");
  }
}

async function finishRun(r: RoutineRow, runId: string, lateRun: boolean, fallback: (s: "done" | "failed", e: string | null) => RunView): Promise<RunView> {
  const db = await getDb();
  const opts = { late: lateRun };
  const messageId = `msg_${hex(8)}`;
  let status: "done" | "failed" = "done";
  let failed: { error: string; action?: { label: string; href: string } } | undefined;
  let parts: UIMessage["parts"] = [];
  let rating: Rating | undefined;
  try {
    parts = compactForStorage(await work(r, runId, messageId, (x) => (rating = x))).parts;
  } catch (e) {
    status = "failed";
    failed = failureOf(e);
  }

  const part: RoutinePart = { type: "data-routine", data: { routineId: r.id, runId, name: r.name, status, late: !!opts.late, at: new Date().toISOString(), ...failed } };
  let saved = false;
  try {
    await db.insert(messages).values({ id: messageId, botId: r.botId, role: "assistant", parts: [part, ...parts], metadata: { routineId: r.id, runId } });
    await touchBot(r.botId);
    saved = true;
  } catch {
    // The bot was deleted while this ran; its routines and runs went with it.
  }
  const [row] = await db
    .update(routineRuns)
    .set({ status, finishedAt: new Date(), messageId: saved ? messageId : null, error: failed?.error ?? null })
    .where(eq(routineRuns.id, runId))
    .returning();

  if (saved) {
    const bot = await getBot(r.botId);
    publish({ type: "message", botId: r.botId, messageId, title: bot?.name, body: status === "done" ? r.name : `${r.name} couldn't run` });
    await notify({
      botId: r.botId,
      kind: status === "done" ? "routine" : "routine-failed",
      body: status === "done" ? (rating?.headline ?? r.name) : `${r.name} couldn't run`,
      importance: status === "done" ? rating?.importance : "high",
      messageId,
    }).catch(() => {});
  }
  publish({ type: "run", botId: r.botId, routineId: r.id, runId, name: r.name, status });
  publish({ type: "routines", botId: r.botId });
  return row ? toRunView(row) : fallback(status, failed?.error ?? null);
}

/** Claims due routines and starts each one without waiting for it to finish. */
export async function startDueRoutines(now: Date): Promise<void> {
  for (const { routine, late } of await claimDueRoutines(now)) {
    runRoutine(routine.id, "schedule", { late }).catch((e) => console.error(`[grid] routine ${routine.id}:`, e));
  }
}
