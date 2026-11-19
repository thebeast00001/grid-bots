import { createBot } from "@/lib/bots/repo";
import { resetDbForTests } from "@/lib/db/client";
import { useTempHome } from "@/lib/test-home";
import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, method = "GET", body?: unknown) =>
  new Request(`http://127.0.0.1:3210${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

test("add, list by scope, search, edit, delete", async () => {
  const bot = await createBot({ name: "Routes", job: "", avatar });
  const you = await (await POST(req("/api/memories", "POST", { botId: null, text: "Likes tea" }))).json();
  const note = await (await POST(req("/api/memories", "POST", { botId: bot.id, text: "Send briefs at 8" }))).json();
  expect(you).toMatchObject({ botId: null, source: "you" });

  const shared = await (await GET(req("/api/memories?scope=you"))).json();
  expect(shared.memories.map((m: { id: string }) => m.id)).toEqual([you.id]);
  const notes = await (await GET(req(`/api/memories?scope=bot&botId=${bot.id}`))).json();
  expect(notes.memories.map((m: { id: string }) => m.id)).toEqual([note.id]);
  const found = await (await GET(req("/api/memories?scope=you&q=TEA"))).json();
  expect(found.memories).toHaveLength(1);

  const edited = await (await PATCH(req("", "PATCH", { text: "Likes green tea", pinned: true }), ctx(you.id))).json();
  expect(edited).toMatchObject({ text: "Likes green tea", pinned: true });
  expect((await DELETE(req("", "DELETE"), ctx(you.id))).status).toBe(204);
  expect((await DELETE(req("", "DELETE"), ctx(you.id))).status).toBe(404);
});

test("bot scope needs a botId", async () => {
  expect((await GET(req("/api/memories?scope=bot"))).status).toBe(400);
});
