import { convertToModelMessages, createIdGenerator, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import { getBot } from "@/lib/bots/repo";
import { inlineFileParts } from "@/lib/chat/files";
import { START, applyIncoming, loadThread, saveAssistant, textOf, trimHistory } from "@/lib/chat/history";
import { buildInstructions } from "@/lib/chat/instructions";
import { makeTools } from "@/lib/chat/tools";
import { errorResponse, notFound, readJson } from "@/lib/http";
import { listMemories } from "@/lib/memory/repo";
import { toGridError } from "@/lib/models/errors";
import { resolveModel } from "@/lib/models/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  botId: z.string(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.array(z.record(z.string(), z.unknown())).min(1).max(20),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  trigger: z.enum(["submit-message", "regenerate-message"]),
});

const newMessageId = createIdGenerator({ prefix: "msg", size: 16 });

/** Reads a stream to the end in the background so the reply is saved even if the browser leaves. */
async function drain(stream: ReadableStream<unknown>) {
  const reader = stream.getReader();
  try {
    for (;;) if ((await reader.read()).done) return;
  } catch {
    // The error is reported to the client stream; nothing else to do here.
  }
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await readJson(req));
    const bot = await getBot(body.botId);
    if (!bot) throw notFound("Bot");
    const incoming = body.message as unknown as UIMessage;

    // A new bot's chat opens with a hidden "[[start]]" message: answer it, never store it.
    const opener = textOf(incoming).startsWith(START);
    const history = opener
      ? [
          ...(await loadThread(bot.id)),
          { ...incoming, parts: [{ type: "text" as const, text: `${START} The user just made you. Say hi in one short line, then ask your first question.` }] },
        ]
      : await applyIncoming(bot.id, incoming, body.trigger);
    const answered = history.filter((m) => m.role === "user" && !textOf(m).startsWith(START)).length;
    const resolved = await resolveModel(bot.model);

    const [botMemories, userMemories] = await Promise.all([listMemories(bot.id), listMemories(null)]);
    const instructions = buildInstructions({
      bot,
      botMemories,
      userMemories,
      now: new Date(),
      interview: { pending: bot.interview === "pending", answered },
      tools: resolved.tools,
    });

    const thread = trimHistory(history);
    const lastUser = [...thread].reverse().find((m) => m.role === "user");
    const tools = resolved.tools && lastUser ? makeTools({ botId: bot.id, lastUserMessageId: lastUser.id }) : undefined;
    const messages = await convertToModelMessages(await inlineFileParts(thread), { tools });

    const result = streamText({ model: resolved.model, instructions, messages, tools, stopWhen: isStepCount(4) });

    // Both copies use the same id so the saved reply matches what the browser showed.
    const replyId = newMessageId();
    const errorText = (e: unknown) => JSON.stringify(toGridError(e).toJSON());

    void drain(
      toUIMessageStream({
        stream: result.stream,
        tools,
        originalMessages: thread,
        generateMessageId: () => replyId,
        onError: errorText,
        onEnd: async ({ messages: all }) => {
          const reply = all.at(-1);
          if (reply?.role === "assistant") await saveAssistant(bot.id, reply);
        },
      }),
    );

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, tools, originalMessages: thread, generateMessageId: () => replyId, onError: errorText }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
