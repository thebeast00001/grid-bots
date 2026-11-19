import type { ToolSet } from "ai";
import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { getList } from "./repo";
import { makeListTools } from "./tools";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "UTC"));

type Out = Record<string, unknown> & { ok: boolean; error?: string; list?: { id: string; name: string; kind: string; open: number; done: number; total?: number; month?: number } };
const run = async (tools: ToolSet, name: string, input: unknown): Promise<Out> => (await tools[name].execute!(input as never, { toolCallId: "t", messages: [] } as never)) as Out;
const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
let tools: ToolSet;
let botId: string;
beforeAll(async () => {
  botId = (await createBot({ name: "Lister", job: "", avatar })).id;
  tools = makeListTools({ botId, zone: "UTC" });
});

test("create a checklist; find it; read it", async () => {
  const made = await run(tools, "create_list", { name: "Groceries", kind: "checklist", items: ["milk", "eggs"] });
  expect(made).toMatchObject({ ok: true, list: { name: "Groceries", kind: "checklist", open: 2, done: 0 } });
  expect((await getList(made.list!.id)).botId).toBe(botId);
  const found = await run(tools, "find_lists", {});
  expect(found.lists).toContainEqual(expect.objectContaining({ id: made.list!.id, name: "Groceries" }));
  const read = await run(tools, "read_list", { id: made.list!.id });
  expect(read.items).toEqual([expect.objectContaining({ text: "milk", done: false }), expect.objectContaining({ text: "eggs", done: false })]);
});

test("change a list: add, tick, untick, edit, remove and rename in one call", async () => {
  const l = (await run(tools, "create_list", { name: "Packing", items: ["hat", "sunscreen", "map"] })).list!;
  const [hat, sunscreen, map] = (await getList(l.id)).items;
  const out = await run(tools, "change_list", { id: l.id, add: ["charger"], tick: [hat.id, sunscreen.id], untick: [sunscreen.id], edit: [{ id: map.id, text: "paper map" }], rename: "Packing for Goa" });
  expect(out).toMatchObject({ ok: true, list: { name: "Packing for Goa", open: 3, done: 1 }, added: [{ text: "charger" }] });
  await run(tools, "change_list", { id: l.id, remove: [map.id] });
  expect((await getList(l.id)).items.map((i) => i.text)).toEqual(["sunscreen", "charger", "hat"]);
});

test("habits: tick checks in today, untick undoes it", async () => {
  const h = (await run(tools, "create_list", { name: "Habits", kind: "habits", items: ["Run"] })).list!;
  const run1 = (await getList(h.id)).items[0];
  expect(await run(tools, "change_list", { id: h.id, tick: [run1.id] })).toMatchObject({ list: { done: 1 } });
  const read = await run(tools, "read_list", { id: h.id });
  expect(read.items).toEqual([expect.objectContaining({ text: "Run", streak: 1, today: true })]);
  expect(await run(tools, "change_list", { id: h.id, untick: [run1.id] })).toMatchObject({ list: { done: 0 } });
});

test("log_expense: to the newest expenses list, or a new one; amounts in whole units", async () => {
  const first = await run(tools, "log_expense", { text: "Lunch", amount: 250.5, currency: "INR" });
  expect(first).toMatchObject({ ok: true, list: { name: "Expenses", kind: "expenses", total: 250.5 }, item: { text: "Lunch", amount: 250.5 } });
  const second = await run(tools, "log_expense", { text: "Tea", amount: 20 });
  expect(second.list!.id).toBe(first.list!.id);
  expect(second.list!.total).toBe(270.5);
  const read = await run(tools, "read_list", { id: first.list!.id });
  expect(read.items).toContainEqual(expect.objectContaining({ text: "Tea", amount: 20 }));
});

test("with several expense lists: the one called Expenses, else ask which", async () => {
  const trip = await run(tools, "create_list", { name: "Goa trip money", kind: "expenses" }); // newer than Expenses
  const taxi = await run(tools, "log_expense", { text: "Taxi", amount: 300 });
  expect(taxi.list!.name).toBe("Expenses");
  await run(tools, "change_list", { id: taxi.list!.id, rename: "Home spending" });
  const unsure = await run(tools, "log_expense", { text: "Taxi", amount: 300 });
  expect(unsure.ok).toBe(false);
  expect(unsure.error).toMatch(/several expense lists/);
  expect(unsure.error).toContain("Goa trip money");
  expect(unsure.error).toContain("Home spending");
  expect((await run(tools, "log_expense", { text: "Taxi", amount: 300, listId: trip.list!.id })).list!.name).toBe("Goa trip money");
});

test("unknown ids and too many items are plain errors, and nothing changes", async () => {
  const l = (await run(tools, "create_list", { name: "Strict", items: ["a"] })).list!;
  expect(await run(tools, "read_list", { id: "lst_nope" })).toEqual({ ok: false, error: "No list with that id. Use find_lists to see them." });
  expect(await run(tools, "change_list", { id: l.id, add: ["b"], tick: ["itm_nope"] })).toEqual({ ok: false, error: "No item itm_nope on this list. Use read_list to see its items." });
  expect((await getList(l.id)).items).toHaveLength(1);
  expect((await run(tools, "change_list", { id: l.id, add: Array.from({ length: 51 }, (_, i) => `x${i}`) })).ok).toBe(false);
  expect((await run(tools, "create_list", { name: "" })).error).toBe("Give the list a name.");
  expect((await run(tools, "log_expense", { text: "Bad", amount: -3 })).ok).toBe(false);
});

test("there's no tool to delete a list", () => {
  expect(Object.keys(tools).sort()).toEqual(["change_list", "create_list", "find_lists", "log_expense", "read_list"]);
});
