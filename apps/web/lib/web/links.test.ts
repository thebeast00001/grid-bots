import type { UIMessage } from "ai";
import { knownLinks } from "./links";

const user = (text: string): UIMessage => ({ id: `u${Math.random()}`, role: "user", parts: [{ type: "text", text }] });
const bot = (parts: unknown[]): UIMessage => ({ id: `a${Math.random()}`, role: "assistant", parts: parts as UIMessage["parts"] });

test("any page on a site the user named, by link or bare domain, with or without www", () => {
  const k = knownLinks([user("compare https://www.shop.example/item/1 with prices on deals.example.org please")]);
  expect(k.allows("https://shop.example/other?x=1")).toBe(true);
  expect(k.allows("http://www.deals.example.org/today")).toBe(true);
  expect(k.allows("https://elsewhere.example/")).toBe(false);
});

test("a site the bot mentioned itself doesn't count", () => {
  const k = knownLinks([user("hi"), bot([{ type: "text", text: "Try https://made-up.example/" }])]);
  expect(k.allows("https://made-up.example/")).toBe(false);
});

test("search results, page links and sources from earlier replies: exact links only", () => {
  const k = knownLinks([
    user("what's new?"),
    bot([
      { type: "tool-web_search", toolCallId: "1", state: "output-available", input: {}, output: { ok: true, results: [{ n: 1, url: "https://news.example/a", title: "A", site: "news.example", snippet: "" }] } },
      { type: "tool-read_page", toolCallId: "2", state: "output-available", input: {}, output: { ok: true, n: 1, url: "https://news.example/a", links: [{ text: "B", url: "https://other.example/b" }] } },
      { type: "source-url", sourceId: "s1", url: "https://cited.example/c#part" },
    ]),
  ]);
  expect(k.allows("https://news.example/a")).toBe(true);
  expect(k.allows("https://news.example/a#section")).toBe(true); // fragments don't matter
  expect(k.allows("https://news.example/a?leak=1")).toBe(false);
  expect(k.allows("https://other.example/b")).toBe(true);
  expect(k.allows("https://cited.example/c")).toBe(true);
  expect(k.allows("https://other.example/")).toBe(false);
});

test("links added during the reply count; nothing but http(s)", () => {
  const k = knownLinks([user("go")]);
  k.add("https://later.example/x");
  expect(k.allows("https://later.example/x")).toBe(true);
  expect(k.allows("file:///etc/passwd")).toBe(false);
  expect(k.allows("not a url")).toBe(false);
});

test("a page can't add its own site to the trusted list by naming it", () => {
  const k = knownLinks([user("read https://grid.test/injection")]);
  k.add("https://evil.example/");
  expect(k.allows("https://evil.example/")).toBe(true);
  expect(k.allows("https://evil.example/collect?data=lives+in+Pune")).toBe(false);
});
