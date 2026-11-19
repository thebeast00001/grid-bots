import { resetDbForTests } from "@/lib/db/client";
import { getSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { unseal } from "@/lib/vault";
import { builtInSearch, getSearchService, search, setSearchService } from "./search";

useTempHome();
afterAll(() => resetDbForTests());
beforeEach(() => setSearchService(null));

type Seen = { url: string; init?: RequestInit };
function fakeFetch(respond: (s: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const s = { url: String(url), init };
    seen.push(s);
    return respond(s);
  }) as typeof fetch;
  return { f, seen };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Brave: key in its header, results parsed and cleaned", async () => {
  await setSearchService({ kind: "brave", key: "brave-key-12345" });
  const { f, seen } = fakeFetch(() =>
    json({
      web: {
        results: [
          { title: "Pune weather", url: "https://weather.example/pune", description: "Sunny, <strong>31°C</strong> &amp; dry" },
          { title: "Bad", url: "javascript:alert(1)", description: "x" },
          { title: "", url: "https://www.second.example/a", description: "" },
        ],
      },
    }),
  );
  const r = await search("pune weather", { fetch: f });
  expect(seen[0].url).toBe("https://api.search.brave.com/res/v1/web/search?q=pune+weather&count=8");
  expect(new Headers(seen[0].init?.headers).get("x-subscription-token")).toBe("brave-key-12345");
  expect(r).toEqual({
    ok: true,
    results: [
      { title: "Pune weather", url: "https://weather.example/pune", site: "weather.example", snippet: "Sunny, 31°C & dry" },
      { title: "second.example", url: "https://www.second.example/a", site: "second.example", snippet: "" },
    ],
  });
});

test("Tavily: bearer key and a JSON body", async () => {
  await setSearchService({ kind: "tavily", key: "tvly-key-12345" });
  const { f, seen } = fakeFetch(() => json({ results: [{ title: "T", url: "https://t.example/", content: "about t" }] }));
  const r = await search("t", { fetch: f });
  expect(seen[0].url).toBe("https://api.tavily.com/search");
  expect(seen[0].init?.method).toBe("POST");
  expect(new Headers(seen[0].init?.headers).get("authorization")).toBe("Bearer tvly-key-12345");
  expect(JSON.parse(String(seen[0].init?.body))).toEqual({ query: "t", max_results: 8 });
  expect(r).toMatchObject({ ok: true, results: [{ title: "T", site: "t.example", snippet: "about t" }] });
});

test("SearXNG: the user's own address, JSON format", async () => {
  await setSearchService({ kind: "searxng", url: "http://192.168.1.20:8888/" });
  const { f, seen } = fakeFetch(() => json({ results: [{ title: "S", url: "https://s.example/", content: "about s" }] }));
  await search("s & t", { fetch: f });
  expect(seen[0].url).toBe("http://192.168.1.20:8888/search?q=s+%26+t&format=json");
});

test("at most 8 results", async () => {
  await setSearchService({ kind: "tavily", key: "tvly-key-12345" });
  const many = Array.from({ length: 12 }, (_, i) => ({ title: `R${i}`, url: `https://r.example/${i}`, content: "" }));
  const { f } = fakeFetch(() => json({ results: many }));
  const r = await search("r", { fetch: f });
  expect(r.ok && r.results).toHaveLength(8);
});

test("errors in plain words", async () => {
  await setSearchService({ kind: "brave", key: "brave-key-12345" });
  const run = async (respond: () => Response | Promise<Response>) => search("q", { fetch: fakeFetch(respond).f });
  expect(await run(() => json({}, 401))).toEqual({ ok: false, error: "Brave Search says the key isn't valid. Check it in Settings → Web." });
  expect(await run(() => json({}, 429))).toEqual({ ok: false, error: "Brave Search says you're over your limit for now." });
  expect(await run(() => json({}, 502))).toEqual({ ok: false, error: "Brave Search had a problem (502)." });
  expect(await run(() => Promise.reject(new TypeError("fetch failed")))).toEqual({ ok: false, error: "Couldn't reach Brave Search." });
  expect(await run(() => new Response("<html>", { status: 200 }))).toEqual({ ok: false, error: "Brave Search sent something Grid couldn't read." });
  await setSearchService({ kind: "searxng", url: "http://localhost:8888" });
  expect(await run(() => json({}, 403))).toEqual({ ok: false, error: "SearXNG refused. Turn on the json format in its settings.yml (search → formats)." });
});

test("no service: search says so", async () => {
  expect(await search("q")).toEqual({ ok: false, error: "No search service is set up. The user can add one in Settings → Web." });
});

test("the key is sealed, never given back, and kept when not sent again", async () => {
  await setSearchService({ kind: "brave", key: "brave-key-SECRET-9" });
  const stored = await getSetting<{ key: string }>("searchService");
  expect(JSON.stringify(stored)).not.toContain("SECRET");
  expect(await unseal(stored!.key)).toBe("brave-key-SECRET-9");
  expect(await getSearchService()).toEqual({ kind: "brave", hasKey: true });

  await setSearchService({ kind: "brave" }); // e.g. saving the page again without retyping it
  expect(await unseal((await getSetting<{ key: string }>("searchService"))!.key)).toBe("brave-key-SECRET-9");
});

test("bad settings are refused", async () => {
  await expect(setSearchService({ kind: "brave" })).rejects.toThrow("needs a key");
  await expect(setSearchService({ kind: "tavily", key: "short" })).rejects.toThrow("doesn't look like a key");
  await expect(setSearchService({ kind: "searxng", url: "ftp://x" })).rejects.toThrow("http");
  await expect(setSearchService({ kind: "searxng" })).rejects.toThrow("address");
  // A key for another service isn't carried over.
  await setSearchService({ kind: "brave", key: "brave-key-12345" });
  await expect(setSearchService({ kind: "tavily" })).rejects.toThrow("needs a key");
});

test("the test service only exists in test mode, and answers from the fixture site", async () => {
  await setSearchService({ kind: "test" });
  const r = await search("grid bots");
  expect(r.ok && r.results.map((x) => x.url)).toContain("https://grid.test/guide");
  expect(await search("nothing at all")).toEqual({ ok: true, results: [] });
  expect(await search("make it fail")).toEqual({ ok: false, error: "Test search is down." });
  const was = process.env.VITEST;
  process.env.VITEST = "";
  try {
    await expect(setSearchService({ kind: "test" })).rejects.toThrow();
  } finally {
    process.env.VITEST = was;
  }
});

test("which providers search on their own", () => {
  expect(builtInSearch("chatgpt")).toEqual({ label: "ChatGPT's own search" });
  expect(builtInSearch("openai")).toEqual({ label: "OpenAI's own search" });
  expect(builtInSearch("anthropic")).toEqual({ label: "Claude's own search" });
  for (const k of ["google", "xai", "groq", "mistral", "deepseek", "openrouter", "ollama", "lmstudio", "custom", "mock"] as const) expect(builtInSearch(k)).toBeNull();
});
