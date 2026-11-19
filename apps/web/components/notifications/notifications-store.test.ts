import type { NotificationView } from "@/lib/client-types";

/** A request the test answers when it chooses. */
type Call = { path: string; init?: RequestInit; resolve: (v: unknown) => void };
const calls: Call[] = [];
vi.mock("@/lib/api-client", () => ({
  api: (path: string, init?: RequestInit) => new Promise((resolve) => calls.push({ path, init, resolve })),
}));

const item = (id: string, botId: string, read = false): NotificationView => ({
  id,
  botId,
  kind: "reminder",
  title: "Bot",
  body: id,
  messageId: null,
  importance: "normal",
  ping: true,
  reason: null,
  createdAt: new Date().toISOString(),
  readAt: read ? new Date().toISOString() : null,
});
const inbox = (items: NotificationView[]) => {
  const byBot: Record<string, number> = {};
  for (const n of items) if (!n.readAt) byBot[n.botId] = (byBot[n.botId] ?? 0) + 1;
  return { notifications: items, unread: { total: Object.values(byBot).reduce((a, b) => a + b, 0), byBot } };
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const gets = () => calls.filter((c) => c.path === "/api/notifications" && !c.init);
const posts = () => calls.filter((c) => c.init?.method === "POST");

let store: typeof import("./notifications-store");
beforeEach(async () => {
  calls.length = 0;
  vi.resetModules();
  store = await import("./notifications-store");
});

test("a chat opened before the inbox has loaded still marks its bot read", async () => {
  const loading = store.refreshInbox();
  void store.markBotRead("b1");
  await tick();
  expect(posts().map((c) => JSON.parse(String(c.init?.body)))).toEqual([{ botId: "b1" }]);
  posts()[0].resolve({ changed: 1 });
  gets()[0].resolve(inbox([item("n1", "b1")])); // answered before the server saw the read
  await tick();
  expect(gets()).toHaveLength(2); // so it asks again rather than show it unread
  gets()[1].resolve(inbox([item("n1", "b1", true)]));
  await loading;
  expect(store.getInboxForTests().unread.total).toBe(0);
});

test("an answer that left before a local change never undoes it", async () => {
  const first = store.refreshInbox();
  gets()[0].resolve(inbox([item("n1", "b1"), item("n2", "b2")]));
  await first;
  expect(store.getInboxForTests().unread.total).toBe(2);

  const again = store.refreshInbox();
  void store.markBotRead("b1");
  expect(store.getInboxForTests().unread.byBot).toEqual({ b2: 1 });
  gets()[1].resolve(inbox([item("n1", "b1"), item("n2", "b2")])); // stale
  await tick();
  expect(store.getInboxForTests().unread.byBot).toEqual({ b2: 1 });
  gets()[2].resolve(inbox([item("n1", "b1", true), item("n2", "b2")]));
  await again;
  expect(store.getInboxForTests().unread).toEqual({ total: 1, byBot: { b2: 1 } });
});

test("everything that shows the inbox, mounting at once, loads it once", async () => {
  for (let i = 0; i < 5; i++) void store.loadInbox();
  await tick();
  expect(gets()).toHaveLength(1);
});
