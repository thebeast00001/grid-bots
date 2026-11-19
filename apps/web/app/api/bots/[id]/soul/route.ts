import { z } from "zod";
import { getBot, updateBot } from "@/lib/bots/repo";
import { INTERVIEW_QUESTIONS, defaultSoul, interviewProgress, writeSoul } from "@/lib/bots/soul";
import { loadThread } from "@/lib/chat/history";
import { HttpStatus, errorResponse, notFound, readJson } from "@/lib/http";
import { resolveModel } from "@/lib/models/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ skip: z.boolean().optional() });

/** Ends the interview: writes SOUL.md from it, or a starter soul when skipped. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { skip } = Body.parse(await readJson(req));
    const bot = await getBot((await params).id);
    if (!bot) throw notFound("Bot");
    if (skip) return Response.json(await updateBot(bot.id, { soul: bot.soul || defaultSoul(bot), interview: "skipped" }));

    const thread = await loadThread(bot.id);
    const { answered } = interviewProgress(bot, thread);
    if (answered < INTERVIEW_QUESTIONS) {
      throw new HttpStatus(409, "interview-not-done", `The interview needs ${INTERVIEW_QUESTIONS} answers (${answered} so far).`);
    }
    const { model } = await resolveModel(bot.model);
    const soul = await writeSoul(bot, thread, model);
    return Response.json(await updateBot(bot.id, { soul, interview: "done" }));
  } catch (e) {
    return errorResponse(e);
  }
}
