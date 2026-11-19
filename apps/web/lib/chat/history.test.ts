import type { UIMessage } from "ai";
import { createBot } from "../bots/repo";
import { resetDbForTests } from "../db/client";
import { useTempHome } from "../test-home";
import { applyIncoming, compactForStorage, forModel, loadThread, saveAssistant, trimHistory } from "./history";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const user = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });
const bot = (id: string, text: string): UIMessage => ({ id, role: "assistant", parts: [{ type: "text", text }] });

let run = 0;
async function seeded() {
  const k = ++run;
  const b = await createBot({ name: `B${k}`, job: "", avatar });
  await applyIncoming(b.id, user(`u1-${k}`, "one"), "submit-message");
  await saveAssistant(b.id, bot(`a1-${k}`, "reply one"));
  await applyIncoming(b.id, user(`u2-${k}`, "two"), "submit-message");
  await saveAssistant(b.id, bot(`a2-${k}`, "reply two"));
  return { id: b.id, k };
}

test("submit appends and marks the message read", async () => {
  const { id, k } = await seeded();
  const thread = await loadThread(id);
  expect(thread.map((m) => m.id)).toEqual([`u1-${k}`, `a1-${k}`, `u2-${k}`, `a2-${k}`]);
  expect((thread[0].metadata as { readAt?: string }).readAt).toMatch(/^\d{4}-/);
});

test("editing a user message drops everything after it", async () => {
  const { id, k } = await seeded();
  const thread = await applyIncoming(id, user(`u1-${k}`, "one, edited"), "submit-message");
  expect(thread.map((m) => m.id)).toEqual([`u1-${k}`]);
  expect(thread[0].parts).toEqual([{ type: "text", text: "one, edited" }]);
});

test("regenerate removes the last assistant reply only", async () => {
  const { id, k } = await seeded();
  const thread = await applyIncoming(id, user(`u2-${k}`, "two"), "regenerate-message");
  expect(thread.map((m) => m.id)).toEqual([`u1-${k}`, `a1-${k}`, `u2-${k}`]);
});

test("a message id that belongs to another bot is refused", async () => {
  const { k } = await seeded();
  const other = await createBot({ name: "Other", job: "", avatar });
  await expect(applyIncoming(other.id, user(`u1-${k}`, "steal"), "submit-message")).rejects.toMatchObject({ status: 409 });
});

test("trimHistory keeps the newest messages within the budget", () => {
  const msgs = [user("1", "a".repeat(50)), bot("2", "b".repeat(50)), user("3", "c".repeat(50))];
  expect(trimHistory(msgs, 120).map((m) => m.id)).toEqual(["2", "3"]);
  expect(trimHistory(msgs, 10).map((m) => m.id)).toEqual(["3"]);
});

describe("research in history", () => {
  const page = { ok: true, n: 1, url: "https://grid.test/guide", title: "Guide", site: "grid.test", text: "x".repeat(5000), truncated: false, links: [{ text: "P", url: "https://grid.test/pricing" }] };
  const reply: UIMessage = {
    id: "r1",
    role: "assistant",
    parts: [
      { type: "tool-read_page", toolCallId: "c1", state: "output-available", input: { url: page.url }, output: page },
      { type: "tool-web_search", toolCallId: "c2", state: "output-available", input: { query: "q" }, output: { ok: true, results: [] }, providerExecuted: true },
      { type: "text", text: "Answer [1]." },
    ] as UIMessage["parts"],
  };

  test("stored replies keep a page's address, title and links but not its text", () => {
    const stored = compactForStorage(reply);
    const p = stored.parts[0] as { output: Record<string, unknown> };
    expect(p.output).toMatchObject({ ok: true, n: 1, url: page.url, title: "Guide", site: "grid.test", text: "", chars: 5000, links: page.links });
    expect(stored.parts[2]).toEqual({ type: "text", text: "Answer [1]." });
    expect((reply.parts[0] as { output: { text: string } }).output.text).toHaveLength(5000); // the original is untouched
  });

  test("the model gets earlier replies without page text or the provider's own search steps", () => {
    const [m] = forModel([reply]);
    expect(m.parts.map((p) => p.type)).toEqual(["tool-read_page", "text"]);
    expect((m.parts[0] as { output: { text: string } }).output.text).toBe("");
  });
});
