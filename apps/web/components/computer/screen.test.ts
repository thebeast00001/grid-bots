import type { UIMessage } from "ai";
import { screenOf } from "./screen";

type Parts = UIMessage["parts"];
const p = (x: unknown[]) => x as Parts;
const search = (state: string, output?: unknown) => ({ type: "tool-web_search", toolCallId: "s", state, input: { query: "pune cafes" }, output });
const read = (state: string, url: string, output?: unknown) => ({ type: "tool-read_page", toolCallId: url, state, input: { url }, output });
const results = { ok: true, results: [{ n: 1, url: "https://a.example/1", title: "A one", site: "a.example", snippet: "" }] };

test("nothing going on: the desktop, with the last thing it did", () => {
  expect(screenOf(p([]), { streaming: false })).toEqual({ app: "desktop", last: null });
  expect(screenOf(p([search("output-available", results), read("output-available", "https://a.example/1", { ok: true, title: "A", text: "x" }), { type: "text", text: "Done." }]), { streaming: false })).toEqual({
    app: "desktop",
    last: "Searched once · read 1 page",
  });
});

test("waiting for the first word: thinking", () => {
  expect(screenOf(p([]), { streaming: true })).toEqual({ app: "thinking" });
});

test("a search: the query, then its results as they arrive", () => {
  expect(screenOf(p([search("input-available")]), { streaming: true })).toEqual({ app: "search", query: "pune cafes", results: [], state: "running" });
  expect(screenOf(p([search("output-available", results)]), { streaming: true })).toMatchObject({ app: "search", state: "done", results: [{ title: "A one", site: "a.example" }] });
  expect(screenOf(p([search("output-available", { ok: false, error: "down" })]), { streaming: true })).toMatchObject({ app: "search", state: "failed", error: "down" });
});

test("a page: loading, then its title and first lines", () => {
  expect(screenOf(p([read("input-available", "https://www.b.example/x")]), { streaming: true })).toEqual({ app: "browser", url: "https://www.b.example/x", site: "b.example", state: "loading", lines: [] });
  const text = ["First paragraph.", "", "Second paragraph.", "Third.", "4", "5", "6", "7", "8", "9", "10"].join("\n");
  expect(screenOf(p([read("output-available", "https://b.example/x", { ok: true, title: "B page", url: "https://b.example/x", site: "b.example", text })]), { streaming: true })).toEqual({
    app: "browser",
    url: "https://b.example/x",
    site: "b.example",
    title: "B page",
    state: "reading",
    lines: ["First paragraph.", "Second paragraph.", "Third.", "4", "5", "6", "7", "8"],
  });
  expect(screenOf(p([read("output-available", "https://b.example/x", { ok: false, error: "404" })]), { streaming: true })).toMatchObject({ app: "browser", state: "failed", error: "404" });
});

test("lists and other tools", () => {
  expect(screenOf(p([{ type: "tool-change_list", toolCallId: "c", state: "input-available", input: { id: "l" } }]), { streaming: true })).toEqual({ app: "lists", action: "Updating a list" });
  expect(screenOf(p([{ type: "tool-log_expense", toolCallId: "c", state: "input-available", input: { text: "Lunch" } }]), { streaming: true })).toEqual({ app: "lists", action: "Logging Lunch" });
  expect(screenOf(p([{ type: "tool-set_reminder", toolCallId: "r", state: "input-available", input: {} }]), { streaming: true })).toEqual({ app: "task", label: "Setting a reminder" });
});

test("writing the reply: the last part of it", () => {
  const long = "word ".repeat(200).trim();
  const s = screenOf(p([search("output-available", results), { type: "text", text: long }]), { streaming: true });
  expect(s.app).toBe("writer");
  expect(s.app === "writer" && s.text.length).toBeLessThanOrEqual(400);
  expect(s.app === "writer" && long.endsWith(s.text)).toBe(true);
});

test("a routine running in the background", () => {
  expect(screenOf(p([]), { streaming: false, run: "Morning briefing" })).toEqual({ app: "routine", name: "Morning briefing" });
});
