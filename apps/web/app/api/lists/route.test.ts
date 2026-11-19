import { resetDbForTests } from "@/lib/db/client";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { POST as checkin } from "./[id]/checkins/route";
import { DELETE as removeItem, PATCH as patchItem } from "./[id]/items/[itemId]/route";
import { POST as addItems, PUT as reorder } from "./[id]/items/route";
import { DELETE as deleteList, GET as getList, PATCH as patchList } from "./[id]/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());
beforeAll(() => setSetting("timezone", "UTC"));

const req = (method: string, body?: unknown) => new Request("http://127.0.0.1:3210/api/lists", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ictx = (id: string, itemId: string) => ({ params: Promise.resolve({ id, itemId }) });
type Item = { id: string; text: string; done: boolean };

test("create, list, read, rename, delete", async () => {
  const created = await POST(req("POST", { name: "Groceries", kind: "checklist", items: [{ text: "milk" }] }));
  expect(created.status).toBe(201);
  const l = await created.json();
  expect(l).toMatchObject({ name: "Groceries", kind: "checklist", open: 1 });
  expect((await (await GET()).json()).lists.map((x: { id: string }) => x.id)).toContain(l.id);
  expect(await (await getList(req("GET"), ctx(l.id))).json()).toMatchObject({ id: l.id, items: [{ text: "milk" }] });
  expect(await (await patchList(req("PATCH", { name: "Food" }), ctx(l.id))).json()).toMatchObject({ name: "Food" });
  expect((await deleteList(req("DELETE"), ctx(l.id))).status).toBe(204);
  expect((await getList(req("GET"), ctx(l.id))).status).toBe(404);
});

test("items: add, tick, edit, reorder, remove", async () => {
  const l = await (await POST(req("POST", { name: "Packing", kind: "checklist" }))).json();
  const added = await (await addItems(req("POST", { items: [{ text: "a" }, { text: "b" }, { text: "c" }] }), ctx(l.id))).json();
  const [a, b, c] = added.items as Item[];
  expect(await (await patchItem(req("PATCH", { done: true }), ictx(l.id, a.id))).json()).toMatchObject({ id: a.id, done: true });
  expect(await (await patchItem(req("PATCH", { text: "bee" }), ictx(l.id, b.id))).json()).toMatchObject({ text: "bee" });
  const re = await (await reorder(req("PUT", { ids: [c.id, b.id] }), ctx(l.id))).json();
  expect(re.items.map((i: Item) => i.text)).toEqual(["c", "bee", "a"]);
  expect((await removeItem(req("DELETE"), ictx(l.id, c.id))).status).toBe(204);
  expect((await (await getList(req("GET"), ctx(l.id))).json()).items).toHaveLength(2);
});

test("unknown lists and items, and items of another list, are 404s", async () => {
  const one = await (await POST(req("POST", { name: "One", kind: "checklist", items: [{ text: "x" }] }))).json();
  const two = await (await POST(req("POST", { name: "Two", kind: "checklist" }))).json();
  expect((await getList(req("GET"), ctx("lst_nope"))).status).toBe(404);
  expect((await patchItem(req("PATCH", { done: true }), ictx(two.id, one.items[0].id))).status).toBe(404);
  expect((await removeItem(req("DELETE"), ictx(two.id, one.items[0].id))).status).toBe(404);
  expect((await addItems(req("POST", { items: [{ text: "y" }] }), ctx("lst_nope"))).status).toBe(404);
});

test("bad input is a 400 with a reason", async () => {
  const r = await POST(req("POST", { name: "", kind: "checklist" }));
  expect(r.status).toBe(400);
  expect((await r.json()).error.message).toBe("Give the list a name.");
  expect((await POST(req("POST", { name: "x", kind: "shopping" }))).status).toBe(400);
  const l = await (await POST(req("POST", { name: "Ordered", kind: "checklist", items: [{ text: "a" }, { text: "b" }] }))).json();
  expect((await reorder(req("PUT", { ids: [l.items[0].id] }), ctx(l.id))).status).toBe(400);
  expect((await addItems(req("POST", { items: Array.from({ length: 51 }, () => ({ text: "z" })) }), ctx(l.id))).status).toBe(400);
});

test("habit check-ins: a real day, not in the future", async () => {
  const h = await (await POST(req("POST", { name: "Habits", kind: "habits", items: [{ text: "Run" }] }))).json();
  const today = new Date().toISOString().slice(0, 10);
  const on = await (await checkin(req("POST", { itemId: h.items[0].id, day: today, on: true }), ctx(h.id))).json();
  expect(on.items[0]).toMatchObject({ streak: 1, checkins: [today] });
  expect((await checkin(req("POST", { itemId: h.items[0].id, day: "2999-01-01", on: true }), ctx(h.id))).status).toBe(400);
  expect((await checkin(req("POST", { itemId: h.items[0].id, day: "yesterday", on: true }), ctx(h.id))).status).toBe(400);
});

test("expenses: amounts and days", async () => {
  const e = await (await POST(req("POST", { name: "Spend", kind: "expenses", currency: "INR" }))).json();
  const { items } = await (await addItems(req("POST", { items: [{ text: "Lunch", amount: 25_000, spentOn: "2026-11-19" }] }), ctx(e.id))).json();
  expect(items[0]).toMatchObject({ amount: 25_000, spentOn: "2026-11-19" });
  expect(await (await getList(req("GET"), ctx(e.id))).json()).toMatchObject({ total: 25_000, currency: "INR" });
  expect((await patchItem(req("PATCH", { amount: -5 }), ictx(e.id, items[0].id))).status).toBe(400);
});
