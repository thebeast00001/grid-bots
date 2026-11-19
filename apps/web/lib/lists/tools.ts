import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ListView } from "../client-types";
import { HttpStatus } from "../http";
import { addItems, checkIn, createList, getList, listLists, removeItems, renameList, todayIn, updateItem, type NewItem } from "./repo";

/**
 * Bots keep the user's lists: they make them, find them, read them and change them. There is
 * deliberately no tool to delete a list (a web page could try to talk a bot into it); the
 * user deletes lists in the Lists tab. Amounts are whole units here (250.5), hundredths inside.
 */

const MAX_PER_CALL = 50;
const NO_LIST = { ok: false as const, error: "No list with that id. Use find_lists to see them." };

const units = (hundredths: number | null | undefined) => (hundredths == null ? undefined : hundredths / 100);
const hundredths = (u: number | undefined) => (u == null ? undefined : Math.round(u * 100));

/** What the bot (and the chat card, by id) needs: not the whole list. */
function brief(v: ListView) {
  return {
    id: v.id,
    name: v.name,
    kind: v.kind,
    open: v.open,
    done: v.done,
    ...(v.kind === "expenses" ? { total: units(v.total), month: units(v.month), currency: v.currency } : {}),
  };
}

const TOO_MANY = { ok: false as const, error: `At most ${MAX_PER_CALL} items at a time. Split it into more calls.` };
const tooMany = (...lists: (unknown[] | undefined)[]) => lists.some((l) => (l?.length ?? 0) > MAX_PER_CALL);

const failed = (e: unknown) => {
  if (e instanceof HttpStatus) return { ok: false as const, error: e.code === "not-found" ? NO_LIST.error : e.message };
  throw e;
};

const ItemIn = z.union([
  z.string().min(1).max(200),
  z.object({ text: z.string().min(1).max(200), amount: z.number().min(0).optional().describe("Expenses only, in whole units (e.g. 250.5)"), spentOn: z.string().optional().describe("YYYY-MM-DD") }),
]);
const toNew = (i: z.infer<typeof ItemIn>): NewItem => (typeof i === "string" ? { text: i } : { text: i.text, amount: hundredths(i.amount), spentOn: i.spentOn });
const Ids = z.array(z.string()).max(MAX_PER_CALL);

export function makeListTools(p: { botId: string; zone: string }): ToolSet {
  return {
    create_list: tool({
      description:
        "Make a list the user keeps: kind 'checklist' (groceries, packing, to-dos), 'habits' (things to do daily, with streaks) or 'expenses' (amounts that add up). Check find_lists first; add to an existing list rather than making a second one.",
      inputSchema: z.object({
        name: z.string().max(200),
        kind: z.enum(["checklist", "habits", "expenses"]).default("checklist"),
        items: z.array(ItemIn).max(MAX_PER_CALL).optional(),
        currency: z.string().max(10).optional().describe("Expenses only: a 3-letter code like INR or USD, only if the user made it clear"),
      }),
      execute: async ({ name, kind, items, currency }) => {
        if (tooMany(items)) return TOO_MANY;
        try {
          const v = await createList({ name, kind: kind ?? "checklist", currency, botId: p.botId, items: items?.map(toNew) }, { zone: p.zone });
          return { ok: true as const, list: brief(v) };
        } catch (e) {
          return failed(e);
        }
      },
    }),

    find_lists: tool({
      description: "The user's lists, newest change first: id, name, kind and counts.",
      inputSchema: z.object({}),
      execute: async () => ({ ok: true as const, lists: (await listLists({ zone: p.zone })).map(brief) }),
    }),

    read_list: tool({
      description: "A list's items with their ids (needed to tick, edit or remove them). For habits: streak and whether it's done today.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        try {
          const v = await getList(id, { zone: p.zone });
          const today = v.days?.at(-1);
          return {
            ok: true as const,
            list: brief(v),
            items: v.items.map((i) => ({
              id: i.id,
              text: i.text,
              ...(v.kind === "checklist" ? { done: i.done } : {}),
              ...(v.kind === "habits" ? { streak: i.streak, today: !!today && !!i.checkins?.includes(today) } : {}),
              ...(v.kind === "expenses" ? { amount: units(i.amount), spentOn: i.spentOn } : {}),
            })),
          };
        } catch (e) {
          return failed(e);
        }
      },
    }),

    change_list: tool({
      description:
        "Change a list in one go: add items, tick or untick them (for habits: done today, or not), edit their text (or amount), remove them, or rename the list. Item ids come from read_list.",
      inputSchema: z.object({
        id: z.string(),
        add: z.array(ItemIn).max(MAX_PER_CALL).optional(),
        tick: Ids.optional(),
        untick: Ids.optional(),
        edit: z.array(z.object({ id: z.string(), text: z.string().max(200).optional(), amount: z.number().min(0).optional() })).max(MAX_PER_CALL).optional(),
        remove: Ids.optional(),
        rename: z.string().max(200).optional(),
      }),
      execute: async ({ id, add, tick, untick, edit, remove, rename }) => {
        if (tooMany(add, tick, untick, edit, remove)) return TOO_MANY;
        try {
          const v = await getList(id, { zone: p.zone });
          // Every id must be on this list before anything changes.
          const known = new Set(v.items.map((i) => i.id));
          const unknown = [...(tick ?? []), ...(untick ?? []), ...(remove ?? []), ...(edit ?? []).map((e) => e.id)].find((x) => !known.has(x));
          if (unknown) return { ok: false as const, error: `No item ${unknown} on this list. Use read_list to see its items.` };
          const today = todayIn(p.zone, new Date());
          for (const itemId of tick ?? []) {
            if (v.kind === "habits") await checkIn(id, itemId, today, true, { zone: p.zone });
            else await updateItem(id, itemId, { done: true });
          }
          for (const itemId of untick ?? []) {
            if (v.kind === "habits") await checkIn(id, itemId, today, false, { zone: p.zone });
            else await updateItem(id, itemId, { done: false });
          }
          for (const e of edit ?? []) await updateItem(id, e.id, { text: e.text, amount: hundredths(e.amount) });
          if (remove?.length) await removeItems(id, remove);
          const added = add?.length ? await addItems(id, add.map(toNew), { zone: p.zone }) : [];
          if (rename !== undefined) await renameList(id, rename);
          return { ok: true as const, list: brief(await getList(id, { zone: p.zone })), added: added.map((i) => ({ id: i.id, text: i.text })) };
        } catch (e) {
          return failed(e);
        }
      },
    }),

    log_expense: tool({
      description: "Log money spent (\"I spent 250 on lunch\"). Goes to the given expenses list, else the newest one, else a new list called Expenses.",
      inputSchema: z.object({
        text: z.string().min(1).max(200),
        amount: z.number().min(0).describe("Whole units, e.g. 250.5"),
        currency: z.string().max(10).optional().describe("Only if the user made it clear; used when a new list is made"),
        spentOn: z.string().optional().describe("YYYY-MM-DD; default today"),
        listId: z.string().optional(),
      }),
      execute: async ({ text, amount, currency, spentOn, listId }) => {
        try {
          let target = listId;
          if (target) {
            if ((await getList(target)).kind !== "expenses") return { ok: false as const, error: "That isn't an expenses list." };
          } else {
            target = (await listLists({ zone: p.zone })).find((l) => l.kind === "expenses")?.id;
          }
          if (!target) target = (await createList({ name: "Expenses", kind: "expenses", currency, botId: p.botId }, { zone: p.zone })).id;
          const [item] = await addItems(target, [{ text, amount: hundredths(amount), spentOn }], { zone: p.zone });
          return { ok: true as const, list: brief(await getList(target, { zone: p.zone })), item: { id: item.id, text: item.text, amount: units(item.amount), spentOn: item.spentOn } };
        } catch (e) {
          return failed(e);
        }
      },
    }),
  };
}
