import { z } from "zod";

/** Validation for bot input coming from the browser. */

export const Avatar = z.object({
  shape: z.enum(["orb", "bean", "pebble", "capsule", "cube", "onigiri", "gem", "cloud", "drop", "sprout", "puff", "ghost"]),
  color: z.number().int().min(0).max(15),
  eyes: z.enum(["dot", "oval", "dash", "sparkle", "wide", "button", "sleepy", "happy", "wink", "line"]),
  acc: z.enum(["none", "glasses", "shades", "headphones", "beanie", "beret", "cap", "crown", "party", "bow", "bowtie", "leaf", "antenna", "flower", "halo"]),
  material: z.enum(["flat", "clay", "fuzzy"]),
});

export const NewBot = z.object({
  id: z.string().optional(),
  name: z.string().max(24),
  job: z.string().max(120).default(""),
  avatar: Avatar,
});

export const BotPatchBody = z.object({
  name: z.string().max(24).optional(),
  job: z.string().max(120).optional(),
  avatar: Avatar.optional(),
  soul: z.string().max(20_000).optional(),
  interview: z.enum(["pending", "done", "skipped"]).optional(),
  model: z.object({ providerId: z.string().min(1), modelId: z.string().min(1) }).nullable().optional(),
  instructions: z.array(z.string().min(1).max(500)).max(30).optional(),
});
