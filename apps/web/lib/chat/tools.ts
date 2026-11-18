import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { addMemory } from "../memory/repo";
import { patchMessageMeta } from "./history";

export const REACTIONS = ["❤️", "👍", "😂", "🔥", "👀", "😮"] as const;

/** Tools every bot has in M1: remembering and reacting. */
export function makeTools(p: { botId: string; lastUserMessageId: string }): ToolSet {
  return {
    remember: tool({
      description: "Save something worth remembering. about=user for facts about the user (shared with all their bots); about=self for notes on how to do your job.",
      inputSchema: z.object({ text: z.string().min(1).max(500), about: z.enum(["user", "self"]) }),
      execute: async ({ text, about }) => {
        const m = await addMemory({ botId: about === "self" ? p.botId : null, text, source: "bot", sourceMessageId: p.lastUserMessageId });
        return { saved: true, id: m.id };
      },
    }),
    react: tool({
      description: "React to the user's latest message with one emoji.",
      inputSchema: z.object({ emoji: z.enum(REACTIONS) }),
      execute: async ({ emoji }) => {
        await patchMessageMeta(p.lastUserMessageId, { botReaction: emoji });
        return { reacted: emoji };
      },
    }),
  };
}
