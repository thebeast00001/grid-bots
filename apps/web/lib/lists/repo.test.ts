import { createBot, deleteBot } from "../bots/repo";
import { getDb, resetDbForTests } from "../db/client";
import { habitCheckins, listItems } from "../db/schema";
import { subscribe, type GridEvent } from "../events";
import { setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { MAX_ITEMS, MAX_LISTS, addItems, checkIn, createList, deleteList, getList, listLists, removeItems, renameList, reorder, updateItem } from "./repo";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "Asia/Kolkata"));

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const at = (s: number) => new Date(Date.UTC(2026, 10, 19, 8, 0, s));

test("a checklist keeps its order; done items follow the open ones, most recently done first", async () => {
  const l = await createList({ name: "Groceries", kind: "checklist", items: [{ text: "milk" }, { text: "eggs" }, { text: "bread" }] });
  expect(l).toMatchObject({ name: "Groceries", kind: "checklist", open: 3, done: 0, botId: null, currency: null });
  const [milk, , bread] = l.items;
  await updateItem(l.id, milk.id, { done: true }, { now: at(1) });
  await updateItem(l.id, bread.id, { done: true }, { now: at(2) });
  const v = await getList(l.id);
  expect(v.items.map((i) => [i.text, i.done])).toEqual([
    ["eggs", false],
    ["bread", true],
    ["milk", true],
  ]);
  expect(v).toMatchObject({ open: 1, done: 2 });
  await updateItem(l.id, milk.id, { done: false });
  expect((await getList(l.id)).items.map((i) => i.text)).toEqual(["milk", "eggs", "bread"]);
});

test("new items go last; reorder; edit; remove", async () => {
  const l = await createList({ name: "Packing", kind: "checklist", items: [{ text: "a" }, { text: "b" }] });
  const added = await addItems(l.id, [{ text: "c" }, { text: "  d  " }]);
  expect(added.map((i) => i.text)).toEqual(["c", "d"]);
  const ids = (await getList(l.id)).items.map((i) => i.id);
  await reorder(l.id, [ids[3], ids[0], ids[2], ids[1]]);
  expect((await getList(l.id)).items.map((i) => i.text)).toEqual(["d", "a", "c", "b"]);
  await updateItem(l.id, ids[0], { text: "apples" });
  await removeItems(l.id, [ids[2]]);
  expect((await getList(l.id)).items.map((i) => i.text)).toEqual(["d", "apples", "b"]);
  await expect(reorder(l.id, [ids[0]])).rejects.toThrow(/every open item/);
});

test("limits are plain", async () => {
  await expect(createList({ name: " ", kind: "checklist" })).rejects.toThrow("Give the list a name.");
  await expect(createList({ name: "x".repeat(81), kind: "checklist" })).rejects.toThrow("80 characters");
  const l = await createList({ name: "Big", kind: "checklist", items: Array.from({ length: MAX_ITEMS }, (_, i) => ({ text: `item ${i}` })) });
  await expect(addItems(l.id, [{ text: "one more" }])).rejects.toThrow(`A list holds up to ${MAX_ITEMS} items.`);
  await expect(addItems(l.id, [{ text: "" }])).rejects.toThrow();
  const small = await createList({ name: "Small", kind: "checklist" });
  await expect(addItems(small.id, [{ text: "y".repeat(201) }])).rejects.toThrow("200 characters");
  await expect(createList({ name: "Money", kind: "expenses", currency: "rupees" })).rejects.toThrow("currency");
  expect((await createList({ name: "Money", kind: "expenses", currency: "inr" })).currency).toBe("INR");
  await expect(createList({ name: "Spend", kind: "expenses", items: [{ text: "x", amount: -1 }] })).rejects.toThrow("amount");
});

test("at most 200 lists", async () => {
  const have = (await listLists()).length;
  for (let i = have; i < MAX_LISTS; i++) await createList({ name: `L${i}`, kind: "checklist" });
  await expect(createList({ name: "One too many", kind: "checklist" })).rejects.toThrow(`up to ${MAX_LISTS} lists`);
  for (const l of (await listLists()).filter((x) => /^L\d+$/.test(x.name))) await deleteList(l.id);
});

describe("habits", () => {
  // 00:00 on 20 Nov in India.
  const now = new Date("2026-11-19T18:30:00Z");

  test("the last 7 days and the streak, in the user's time zone", async () => {
    const h = await createList({ name: "Habits", kind: "habits", items: [{ text: "Run" }] });
    const run = h.items[0];
    for (const d of ["2026-11-17", "2026-11-18", "2026-11-19"]) await checkIn(h.id, run.id, d, true, { now });
    let v = await getList(h.id, { now });
    expect(v.days).toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    // Today (the 20th) isn't checked yet: the streak still counts up to yesterday.
    expect(v.items[0]).toMatchObject({ streak: 3, checkins: ["2026-11-17", "2026-11-18", "2026-11-19"] });
    await checkIn(h.id, run.id, "2026-11-20", true, { now });
    expect((await getList(h.id, { now })).items[0].streak).toBe(4);
    await checkIn(h.id, run.id, "2026-11-18", false, { now });
    v = await getList(h.id, { now });
    expect(v.items[0]).toMatchObject({ streak: 2, checkins: ["2026-11-17", "2026-11-19", "2026-11-20"] });
    // A day missed entirely ends it.
    expect((await getList(h.id, { now: new Date("2026-11-22T06:00:00Z") })).items[0].streak).toBe(0);
  });

  test("check-ins are real days, not in the future, and only on habit lists", async () => {
    const h = await createList({ name: "More habits", kind: "habits", items: [{ text: "Read" }] });
    await expect(checkIn(h.id, h.items[0].id, "2026-11-21", true, { now })).rejects.toThrow("future");
    await expect(checkIn(h.id, h.items[0].id, "2026-02-30", true, { now })).rejects.toThrow("date");
    const c = await createList({ name: "Not habits", kind: "checklist", items: [{ text: "x" }] });
    await expect(checkIn(c.id, c.items[0].id, "2026-11-19", true, { now })).rejects.toThrow("habit");
  });
});

test("expenses: newest first, totals for all time and for this month in the user's zone", async () => {
  const e = await createList({
    name: "Expenses",
    kind: "expenses",
    currency: "INR",
    items: [
      { text: "Rent", amount: 2_000_000, spentOn: "2026-10-31" },
      { text: "Lunch", amount: 25_000, spentOn: "2026-11-01" },
    ],
  });
  // 00:30 on 1 Nov in India, still 31 Oct in UTC.
  const now = new Date("2026-10-31T19:00:00Z");
  const india = await getList(e.id, { now });
  expect(india.items.map((i) => i.text)).toEqual(["Lunch", "Rent"]);
  expect(india).toMatchObject({ total: 2_025_000, month: 25_000 });
  expect(await getList(e.id, { now, zone: "UTC" })).toMatchObject({ month: 2_000_000 });
  // No date given: today, in the user's zone.
  const [coffee] = await addItems(e.id, [{ text: "Coffee", amount: 15_000 }], { now });
  expect(coffee.spentOn).toBe("2026-11-01");
});

test("a list outlives the bot that made it; deleting a list takes its items and check-ins", async () => {
  const bot = await createBot({ name: "Maker", job: "", avatar });
  const l = await createList({ name: "Made by a bot", kind: "habits", botId: bot.id, items: [{ text: "Stretch" }] });
  await checkIn(l.id, l.items[0].id, "2026-11-19", true, { now: at(0) });
  await deleteBot(bot.id);
  expect((await getList(l.id)).botId).toBeNull();
  await deleteList(l.id);
  await expect(getList(l.id)).rejects.toThrow("List not found");
  const db = await getDb();
  expect(await db.select().from(listItems).where((await import("drizzle-orm")).eq(listItems.listId, l.id))).toEqual([]);
  expect((await db.select().from(habitCheckins)).filter((c) => c.itemId === l.items[0].id)).toEqual([]);
});

test("rename; the overview lists newest change first with counts but no items", async () => {
  const a = await createList({ name: "Alpha", kind: "checklist", items: [{ text: "x" }] });
  const b = await createList({ name: "Beta", kind: "checklist" });
  await renameList(a.id, "  Alpha two ");
  const all = await listLists();
  expect(all[0]).toMatchObject({ id: a.id, name: "Alpha two", open: 1, items: [] });
  expect(all[1].id).toBe(b.id);
});

test("every change publishes a lists event", async () => {
  const seen: GridEvent[] = [];
  const off = subscribe((e) => seen.push(e));
  const l = await createList({ name: "Evented", kind: "checklist" });
  const [x] = await addItems(l.id, [{ text: "x" }]);
  await updateItem(l.id, x.id, { done: true });
  await renameList(l.id, "Evented 2");
  await deleteList(l.id);
  off();
  const lists = seen.filter((e) => e.type === "lists");
  expect(lists).toHaveLength(5);
  // Each one names its list, so only that list needs reading again.
  expect(lists.every((e) => e.type === "lists" && e.listId === l.id)).toBe(true);
});
