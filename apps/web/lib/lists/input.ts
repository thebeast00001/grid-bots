import { z } from "zod";

/** A new item as the API takes it (the repo checks lengths and amounts). */
export const NewItem = z.object({
  text: z.string().max(1000),
  amount: z.number().int().nullable().optional(),
  spentOn: z.string().max(20).nullable().optional(),
});
