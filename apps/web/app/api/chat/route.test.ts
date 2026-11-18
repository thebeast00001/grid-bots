import type { UIMessage } from "ai";
import { createBot, getBot, updateBot } from "@/lib/bots/repo";
import { loadThread } from "@/lib/chat/history";
import { resetDbForTests } from "@/lib/db/client";
import { listMemories } from "@/lib/memory/repo";
import { addProvider } from "@/lib/models/providers-repo";
import { deleteSetting, setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
let n = 0;
const userMsg = (text: string): UIMessage => ({ id: `u${++n}`, role: "user", parts: [{ type: "text", text }] });
const post = (body: unknown) => POST(new Request("http://127.0.0.1:3210/api/chat", { method: "POST", body: JSON.stringify(body) }));

async function chattyBot() {
  const b = await createBot({ name: `Chat${++n}`, job: "", avatar });
  await updateBot(b.id, { interview: "skipped" });
  return b;
}

async function waitFor<T>(fn: () => Promise<T | undefined>, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 50));
  }
}

const assistantText = async (botId: string) => {
  const last = (await loadThread(botId)).at(-1);
  if (last?.role !== "assistant") return undefined;
  return last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
};

test("chat route returns a typed error when no model is connected", async () => {
  const b = await chattyBot();
  const res = await post({ botId: b.id, message: userMsg("hi"), trigger: "submit-message" });
  expect(res.status).toBe(409);
  expect((await res.json()).error).toMatchObject({ code: "no-model", action: { href: "/welcome" } });
});

describe("with the test model", () => {
  beforeAll(async () => {
    const p = await addProvider({ kind: "mock" });
    await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
  });

  test("streams a reply and saves it", async () => {
    const b = await chattyBot();
    const res = await post({ botId: b.id, message: userMsg("hi"), trigger: "submit-message" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"type":"text-delta"');
    expect(await waitFor(() => assistantText(b.id))).toBe("You said: hi");
    expect((await getBot(b.id))?.updatedAt).toBeTruthy();
  });

  test("saves the reply even if the client disconnects", async () => {
    const b = await chattyBot();
    const res = await post({ botId: b.id, message: userMsg("please keep going"), trigger: "submit-message" });
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(await waitFor(() => assistantText(b.id))).toBe("You said: please keep going");
  });

  test("remember tool stores a memory about the user", async () => {
    const b = await chattyBot();
    const res = await post({ botId: b.id, message: userMsg("remember I like tea"), trigger: "submit-message" });
    await res.text();
    const mems = await waitFor(async () => {
      const m = await listMemories(null);
      return m.some((x) => x.text === "I like tea") ? m : undefined;
    });
    expect(mems.find((x) => x.text === "I like tea")).toMatchObject({ source: "bot", botId: null });
  });

  test("rejects an assistant message from the client", async () => {
    const b = await chattyBot();
    const res = await post({ botId: b.id, message: { id: "x", role: "assistant", parts: [{ type: "text", text: "hi" }] }, trigger: "submit-message" });
    expect(res.status).toBe(400);
  });

  test("unknown bot is a 404", async () => {
    const res = await post({ botId: "bot_0000000000", message: userMsg("hi"), trigger: "submit-message" });
    expect(res.status).toBe(404);
  });
});

describe("without tool support", () => {
  test("omits tools when the model has no tool support", async () => {
    vi.resetModules();
    vi.doMock("@/lib/models/resolve", async () => {
      const { mockModel } = await import("@/lib/models/mock");
      return { resolveModel: async () => ({ model: mockModel(), ref: { providerId: "p", modelId: "m" }, tools: false, kind: "ollama" }) };
    });
    const { POST: post2 } = await import("./route");
    const b = await chattyBot();
    const before = (await listMemories(null)).length;
    const res = await post2(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify({ botId: b.id, message: userMsg("remember I like jazz"), trigger: "submit-message" }) }));
    await res.text();
    expect(await waitFor(() => assistantText(b.id))).toBe("Got it, I'll keep that in mind.");
    expect((await listMemories(null)).length).toBe(before);
    vi.doUnmock("@/lib/models/resolve");
  });
});

afterAll(() => deleteSetting("defaultModel"));
