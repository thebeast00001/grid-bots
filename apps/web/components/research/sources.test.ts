import type { UIMessage } from "ai";
import { deriveStatus } from "@/components/chat/derive-status";
import { citeLinks, citedNumbers, shownSources, sourcesOf, stepsOf } from "./sources";

type Parts = UIMessage["parts"];
const search = (state: string, output?: unknown, extra: Record<string, unknown> = {}) => ({ type: "tool-web_search", toolCallId: `s${Math.random()}`, state, input: { query: "pune cafes" }, output, ...extra });
const read = (state: string, url: string, output?: unknown) => ({ type: "tool-read_page", toolCallId: `r${url}`, state, input: { url }, output });
const results = {
  ok: true,
  results: [
    { n: 1, url: "https://a.example/1", title: "A one", site: "a.example", snippet: "" },
    { n: 2, url: "https://b.example/2", title: "B two", site: "b.example", snippet: "" },
    { n: 3, url: "https://c.example/3", title: "C three", site: "c.example", snippet: "" },
  ],
};
const page = (n: number, url: string, title: string) => ({ ok: true, n, url, title, site: new URL(url).hostname, text: "", links: [] });

test("sources: pages read, search results, and a model's own sources numbered after them", () => {
  const parts = [
    search("output-available", results),
    read("output-available", "https://a.example/1", page(1, "https://a.example/1", "A one")),
    read("output-available", "https://x.example/", { ok: false, url: "https://x.example/", site: "x.example", error: "nope" }),
    { type: "source-url", sourceId: "p1", url: "https://own.example/o", title: "Own" },
    { type: "source-url", sourceId: "p2", url: "https://a.example/1" }, // already listed
    { type: "text", text: "Answer [1][3]." },
  ] as unknown as Parts;
  const all = sourcesOf(parts);
  expect(all.map((s) => [s.n, s.url, s.read])).toEqual([
    [1, "https://a.example/1", true],
    [2, "https://b.example/2", false],
    [3, "https://c.example/3", false],
    [4, "https://own.example/o", true],
  ]);
  // Chips: what was read or cited.
  expect(shownSources(all, "Answer [1][3].").map((s) => s.n)).toEqual([1, 3, 4]);
});

test("cited numbers: [1], [1][2], [1, 2] — not link text or code", () => {
  expect([...citedNumbers("See [1], then [2][3] and [4, 5].")]).toEqual([1, 2, 3, 4, 5]);
  expect([...citedNumbers("A [link](https://x) and `arr[0]` and [10]")]).toEqual([10]);
});

test("citations become links to their source; unknown numbers stay text", () => {
  const all = sourcesOf([search("output-available", results)] as unknown as Parts);
  expect(citeLinks("Busy on weekends [1][2], quiet [9].", all)).toBe("Busy on weekends [1](#cite-1)[2](#cite-2), quiet [9].");
  expect(citeLinks("Both [1, 3].", all)).toBe("Both [1](#cite-1)[3](#cite-3).");
  expect(citeLinks("Code `x[1]` and\n```\ny[2]\n```\nok [2]", all)).toBe("Code `x[1]` and\n```\ny[2]\n```\nok [2](#cite-2)");
  expect(citeLinks("Already [1](https://a.example/1)", all)).toBe("Already [1](https://a.example/1)");
});

test("steps: searches and reads in order, with how each went", () => {
  const steps = stepsOf([
    search("output-available", results),
    read("output-available", "https://a.example/1", page(1, "https://a.example/1", "A one")),
    read("input-available", "https://www.b.example/2"),
    read("output-available", "https://x.example/", { ok: false, error: "The site had a problem (500)." }),
    search("output-available", { action: { type: "search", query: "own search" } }, { providerExecuted: true, input: {} }),
  ] as unknown as Parts);
  expect(steps).toEqual([
    { kind: "search", query: "pune cafes", state: "done", count: 3 },
    { kind: "read", url: "https://a.example/1", site: "a.example", title: "A one", state: "done" },
    { kind: "read", url: "https://www.b.example/2", site: "b.example", state: "running" },
    { kind: "read", url: "https://x.example/", site: "x.example", state: "failed", error: "The site had a problem (500)." },
    { kind: "search", query: "own search", state: "done" },
  ]);
});

test("the status line says what the research is doing", () => {
  const last = (parts: unknown[]) => ({ id: "m", role: "assistant", parts }) as UIMessage;
  expect(deriveStatus({ chat: "streaming", last: last([search("input-available")]), justFinished: false })).toEqual({ pose: "working", text: "Searching the web…" });
  expect(
    deriveStatus({ chat: "streaming", last: last([search("output-available", results), read("input-available", "https://a/1"), read("input-available", "https://b/2"), read("input-streaming", "https://c/3")]), justFinished: false }),
  ).toEqual({ pose: "working", text: "Reading 3 pages…" });
  expect(deriveStatus({ chat: "streaming", last: last([read("input-available", "https://a/1")]), justFinished: false })).toEqual({ pose: "working", text: "Reading a page…" });
});

test("the folded line says when a search failed", async () => {
  const { summary } = await import("./sources");
  const failed = { kind: "search" as const, query: "q", state: "failed" as const, error: "down" };
  const ok = { kind: "search" as const, query: "q", state: "done" as const, count: 6 };
  const page = { kind: "read" as const, url: "https://a/", site: "a", state: "done" as const };
  expect(summary([failed])).toBe("Search failed");
  expect(summary([ok, failed, page])).toBe("Searched once · 1 search failed · read 1 page");
  expect(summary([ok, page])).toBe("Searched once · read 1 page");
});

test("a model's own sources become chips only for http(s) links", () => {
  const all = sourcesOf([
    { type: "source-url", sourceId: "a", url: "javascript:alert(1)", title: "Bad" },
    { type: "source-url", sourceId: "b", url: "data:text/html,hi" },
    { type: "source-url", sourceId: "c", url: "https://fine.example/x", title: "Fine" },
  ] as unknown as Parts);
  expect(all.map((s) => s.url)).toEqual(["https://fine.example/x"]);
});
