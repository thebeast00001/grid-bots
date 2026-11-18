import { listModels } from "./catalog";
import { detectLocal } from "./detect";

afterEach(() => vi.unstubAllGlobals());

type Call = [string, RequestInit | undefined];
function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("openai-style listModels reads data[].id with a bearer key", async () => {
  const f = stubFetch(() => json({ data: [{ id: "gpt-x" }, { id: "gpt-y" }] }));
  const models = await listModels({ kind: "openai", baseUrl: "https://api.openai.com/v1", secret: { apiKey: "sk-1" } });
  expect(models.map((m) => m.id)).toEqual(["gpt-x", "gpt-y"]);
  expect(models[0].tools).toBe(true);
  const [url, init] = f.mock.calls[0] as unknown as Call;
  expect(url).toBe("https://api.openai.com/v1/models");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-1");
});

test("anthropic listModels sends x-api-key and anthropic-version", async () => {
  const f = stubFetch(() => json({ data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }] }));
  const models = await listModels({ kind: "anthropic", baseUrl: null, secret: { apiKey: "ak" } });
  expect(models).toEqual([{ id: "claude-opus-5-5", name: "Claude Opus 5.5", tools: true, vision: true }]);
  const [url, init] = f.mock.calls[0] as unknown as Call;
  expect(url).toBe("https://api.anthropic.com/v1/models");
  const h = new Headers(init?.headers);
  expect(h.get("x-api-key")).toBe("ak");
  expect(h.get("anthropic-version")).toBe("2023-06-01");
});

test("google listModels keeps generateContent models and strips models/", async () => {
  stubFetch(() =>
    json({
      models: [
        { name: "models/gemini-x", displayName: "Gemini X", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embed-y", displayName: "Embed Y", supportedGenerationMethods: ["embedContent"] },
      ],
    }),
  );
  const models = await listModels({ kind: "google", baseUrl: null, secret: { apiKey: "g" } });
  expect(models.map((m) => m.id)).toEqual(["gemini-x"]);
  expect(models[0].name).toBe("Gemini X");
});

test("ollama model without tools capability reports tools:false", async () => {
  stubFetch((url, init) => {
    if (url === "http://127.0.0.1:11434/api/tags") return json({ models: [{ name: "llama-small" }, { name: "qwen-tools" }] });
    expect(url).toBe("http://127.0.0.1:11434/api/show");
    const model = JSON.parse(String(init?.body)).model as string;
    return json({ capabilities: model === "qwen-tools" ? ["completion", "tools", "vision"] : ["completion"] });
  });
  const models = await listModels({ kind: "ollama", baseUrl: "http://127.0.0.1:11434", secret: null });
  expect(models).toEqual([
    { id: "llama-small", name: "llama-small", tools: false, vision: false },
    { id: "qwen-tools", name: "qwen-tools", tools: true, vision: true },
  ]);
});

test("lmstudio models report unknown tool support", async () => {
  stubFetch(() => json({ data: [{ id: "local-1" }] }));
  const models = await listModels({ kind: "lmstudio", baseUrl: "http://127.0.0.1:1234/v1", secret: null });
  expect(models[0].tools).toBeNull();
});

test("listModels turns a 401 into an auth error", async () => {
  stubFetch(() => json({ error: "bad key" }, 401));
  await expect(listModels({ kind: "openai", baseUrl: "https://api.openai.com/v1", secret: { apiKey: "bad" } })).rejects.toMatchObject({
    code: "auth",
  });
});

test("detectLocal reports which local servers answer", async () => {
  stubFetch((url) => (url.includes("11434") ? json({ models: [] }) : Promise.reject(new TypeError("fetch failed"))));
  expect(await detectLocal()).toEqual({ ollama: true, lmstudio: false });
});
