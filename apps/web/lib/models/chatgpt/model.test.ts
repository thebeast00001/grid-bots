import { generateText } from "ai";
import { resetDbForTests } from "../../db/client";
import { useTempHome } from "../../test-home";
import { addProvider } from "../providers-repo";
import { chatgptModel } from "./model";

useTempHome();
afterAll(() => resetDbForTests());
afterEach(() => vi.unstubAllGlobals());

test("earlier replies are sent in full, never as references to stored items", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
  const p = await addProvider({
    kind: "chatgpt",
    secret: { access: "tok", refresh: "r", expiresAt: Date.now() + 3_600_000, clientId: "c", sub: "u" },
  });

  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ error: { message: "stop here" } }, { status: 400 });
    }),
  );

  await generateText({
    model: chatgptModel(p.id, "gpt-5.1"),
    maxRetries: 0,
    messages: [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "", providerOptions: { openai: { itemId: "rs_1", reasoningEncryptedContent: "enc" } } },
          { type: "text", text: "Hello there!", providerOptions: { openai: { itemId: "msg_1" } } },
        ],
      },
      { role: "user", content: "remind me on friday to take a break" },
    ],
  }).catch(() => {});

  // The ChatGPT plan never stores responses, so an item_reference can't be found (404).
  const body = bodies[0];
  expect(body.store).toBe(false);
  const input = body.input as { type?: string; role?: string; content?: unknown }[];
  expect(input.some((i) => i.type === "item_reference")).toBe(false);
  expect(JSON.stringify(input)).toContain("Hello there!");
});
