import { resetDbForTests } from "../db/client";
import { useTempHome } from "../test-home";
import { addProvider, listProviders, loadProvider, removeProvider } from "./providers-repo";

useTempHome();
afterAll(() => resetDbForTests());
afterEach(() => vi.unstubAllGlobals());

const okModels = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "gpt-x" }] }))));

test("addProvider rejects a key the provider refuses", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
  await expect(addProvider({ kind: "openai", apiKey: "bad" })).rejects.toMatchObject({ code: "auth" });
  expect(await listProviders()).toEqual([]);
});

test("listProviders never exposes the key, only a 4-char hint", async () => {
  okModels();
  const p = await addProvider({ kind: "openai", apiKey: "sk-live-abcd1234" });
  const list = await listProviders();
  expect(JSON.stringify(list)).not.toContain("sk-live-abcd1234");
  expect(list).toEqual([{ id: p.id, kind: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", hint: "1234" }]);
  expect((await loadProvider(p.id)).secret).toEqual({ apiKey: "sk-live-abcd1234" });
  await removeProvider(p.id);
});

test("a key-based provider needs a key", async () => {
  await expect(addProvider({ kind: "anthropic" })).rejects.toMatchObject({ code: "auth" });
});

test("local providers need no key and use their default address", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }))));
  const p = await addProvider({ kind: "lmstudio" });
  expect(p).toMatchObject({ kind: "lmstudio", baseUrl: "http://127.0.0.1:1234/v1", hint: null });
  await removeProvider(p.id);
});

test("removeProvider forgets it", async () => {
  okModels();
  const p = await addProvider({ kind: "groq", apiKey: "gsk_9999" });
  await removeProvider(p.id);
  expect((await listProviders()).find((x) => x.id === p.id)).toBeUndefined();
});
