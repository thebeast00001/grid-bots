import { resetDbForTests } from "@/lib/db/client";
import { addProvider } from "@/lib/models/providers-repo";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { POST as test_ } from "./test/route";
import { GET, PATCH } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const req = (method: string, body?: unknown) => new Request("http://127.0.0.1:3210/api/web", { method, body: body === undefined ? undefined : JSON.stringify(body) });

test("save a service, read it back without its key, turn it off", async () => {
  const saved = await PATCH(req("PATCH", { service: { kind: "brave", key: "brave-key-SECRET-1" } }));
  expect(saved.status).toBe(200);
  const text = await saved.text();
  expect(text).not.toContain("SECRET");
  expect(JSON.parse(text)).toMatchObject({ service: { kind: "brave", hasKey: true } });
  expect(await (await GET()).text()).not.toContain("SECRET");

  expect(await (await PATCH(req("PATCH", { service: null }))).json()).toMatchObject({ service: null });
});

test("bad input is a 400 with a reason", async () => {
  const r = await PATCH(req("PATCH", { service: { kind: "tavily" } }));
  expect(r.status).toBe(400);
  expect((await r.json()).error.message).toMatch(/needs a key/);
  expect((await PATCH(req("PATCH", { service: { kind: "bing", key: "x".repeat(20) } }))).status).toBe(400);
});

test("names the default model's own search when it has one", async () => {
  // Adding a provider checks it by listing its models; no network in tests.
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
  const p = await addProvider({ kind: "chatgpt", secret: { access: "tok", refresh: "r", expiresAt: Date.now() + 3_600_000, clientId: "c", sub: "u" } });
  vi.unstubAllGlobals();
  await setSetting("defaultModel", { providerId: p.id, modelId: "gpt-5.5" });
  expect(await (await GET()).json()).toMatchObject({ builtIn: { label: "ChatGPT's own search" } });
  const mock = await addProvider({ kind: "mock", label: "Test model" });
  await setSetting("defaultModel", { providerId: mock.id, modelId: "mock-chat" });
  expect((await (await GET()).json()).builtIn).toBeNull();
});

test("the test button runs a search", async () => {
  await PATCH(req("PATCH", { service: null }));
  const none = await test_();
  expect(none.status).toBe(400);
  await PATCH(req("PATCH", { service: { kind: "test" } }));
  const r = await (await test_()).json();
  expect(r.ok).toBe(true);
  expect(r.count).toBeGreaterThan(0);
});
