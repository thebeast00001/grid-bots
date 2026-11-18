import { resetDbForTests } from "@/lib/db/client";
import { useTempHome } from "@/lib/test-home";
import { DELETE, GET as getOne, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" };
const req = (method: string, body?: unknown) => new Request("http://127.0.0.1:3210/api/bots", { method, body: body ? JSON.stringify(body) : undefined });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("create with a client id, list, patch, delete", async () => {
  const created = await POST(req("POST", { id: "bot_abcdefghij", name: "Maya", job: "Runs my week", avatar }));
  expect(created.status).toBe(201);
  expect(await created.json()).toMatchObject({ id: "bot_abcdefghij", handle: "maya" });

  const list = await (await GET()).json();
  expect(list.bots.map((b: { id: string }) => b.id)).toEqual(["bot_abcdefghij"]);

  const patched = await PATCH(req("PATCH", { interview: "skipped", instructions: ["Be brief"] }), ctx("bot_abcdefghij"));
  expect(await patched.json()).toMatchObject({ interview: "skipped", instructions: ["Be brief"] });

  expect((await DELETE(req("DELETE"), ctx("bot_abcdefghij"))).status).toBe(204);
  expect((await getOne(req("GET"), ctx("bot_abcdefghij"))).status).toBe(404);
});

test("rejects a bad avatar and a blank name", async () => {
  expect((await POST(req("POST", { name: "X", job: "", avatar: { ...avatar, shape: "star" } }))).status).toBe(400);
  const blank = await POST(req("POST", { name: "   ", job: "", avatar }));
  expect(blank.status).toBe(400);
  expect((await blank.json()).error.message).toBe("Give your bot a name.");
});
