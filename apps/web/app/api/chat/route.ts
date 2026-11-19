import { convertToModelMessages, createIdGenerator, createUIMessageStreamResponse, isStepCount, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { getBot } from "@/lib/bots/repo";
import { inlineFileParts } from "@/lib/chat/files";
import { START, applyIncoming, compactForStorage, forModel, loadThread, saveAssistant, textOf, trimHistory } from "@/lib/chat/history";
import { buildInstructions } from "@/lib/chat/instructions";
import { makeTools } from "@/lib/chat/tools";
import { chatUIStream } from "@/lib/chat/ui-stream";
import { errorResponse, notFound, readJson } from "@/lib/http";
import { listMemories } from "@/lib/memory/repo";
import { resolveModel } from "@/lib/models/resolve";
import { userZone } from "@/lib/settings";
import { makeWebTools } from "@/lib/web/tools";

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
    const zone = await userZone();
    const instructions = buildInstructions({
      bot,
      zone,
      botMemories,
      userMemories,
      now: new Date(),
      interview: { pending: bot.interview === "pending", answered },
      tools: resolved.tools,
      search: resolved.search,
    });

    const thread = trimHistory(history);
    const lastUser = [...thread].reverse().find((m) => m.role === "user");
    const tools =
      resolved.tools && lastUser
        ? {
            ...makeTools({ botId: bot.id, lastUserMessageId: lastUser.id, zone }),
            ...makeWebTools({ thread, search: resolved.search }),
            ...(resolved.searchTool ? { web_search: resolved.searchTool } : {}),
          }
        : undefined;
    const messages = await convertToModelMessages(await inlineFileParts(forModel(thread)), { tools });

    // Enough steps to search, read and answer.
    const result = streamText({ model: resolved.model, instructions, messages, tools, stopWhen: isStepCount(8) });

    // Both copies use the same id so the saved reply matches what the browser showed.
    const replyId = newMessageId();

    void drain(
      chatUIStream({
        stream: result.stream,
        tools,
        originalMessages: thread,
        messageId: replyId,
        onEnd: async ({ messages: all }) => {
          const reply = all.at(-1);
          if (reply?.role === "assistant") await saveAssistant(bot.id, compactForStorage(reply));
        },
      }),
    );

    return createUIMessageStreamResponse({
      stream: chatUIStream({ stream: result.stream, tools, originalMessages: thread, messageId: replyId }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
