import type { ListView } from "@/lib/client-types";

/** A request the test answers when it chooses. */
type Call = { path: string; init?: RequestInit; resolve: (v: unknown) => void };
const calls: Call[] = [];
vi.mock("@/lib/api-client", () => ({
  ApiError: class extends Error {},
  api: (path: string, init?: RequestInit) => new Promise((resolve) => calls.push({ path, init, resolve })),
}));

const item = (id: string, done = false) => ({ id, text: id, done, doneAt: null, position: 0, amount: null, spentOn: null });
const view = (items: ReturnType<typeof item>[]): ListView => ({ id: "l1", name: "L", kind: "checklist", botId: null, currency: null, createdAt: "", updatedAt: "", items, open: items.filter((i) => !i.done).length, done: items.filter((i) => i.done).length });
const tick = () => new Promise((r) => setTimeout(r, 0));
const changes = () => calls.filter((c) => c.init?.method && c.init.method !== "GET");
const reads = () => calls.filter((c) => !c.init?.method && c.path === "/api/lists/l1");

let store: typeof import("./lists-store");
beforeEach(async () => {
  calls.length = 0;
  vi.resetModules();
  store = await import("./lists-store");
  const loading = store.refreshList("l1");
  reads()[0].resolve(view([item("a"), item("b"), item("c")]));
  await loading;
});

test("changes to a list reach the server one at a time, in the order they were made", async () => {
  void store.setDone("l1", "a", true);
  void store.reorderItems("l1", ["c", "b"]);
  await tick();
  expect(changes().map((c) => c.init?.method)).toEqual(["PATCH"]); // the reorder waits for the tick
  changes()[0].resolve({});
  await tick();
  expect(changes().map((c) => c.init?.method)).toEqual(["PATCH", "PUT"]);
  expect(reads()).toHaveLength(1); // no refresh while a change is still on its way
  changes()[1].resolve({});
  await tick();
  expect(reads()).toHaveLength(2);
});

test("a refresh that lands while changes are pending doesn't undo them", async () => {
  void store.setDone("l1", "a", true);
  store.refreshAllLists(); // e.g. a lists event from another tab
  await tick();
  reads().at(-1)!.resolve(view([item("a"), item("b"), item("c")])); // still says "a" is open
  await tick();
  expect(store.getListForTests("l1")).toMatchObject({ done: 1 });
});
