import { createBot, getBot } from "@/lib/bots/repo";
import { applyIncoming, saveAssistant } from "@/lib/chat/history";
import { resetDbForTests } from "@/lib/db/client";
import { addProvider } from "@/lib/models/providers-repo";
import { setSetting } from "@/lib/settings";
import { useTempHome } from "@/lib/test-home";
import { POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const post = (id: string, body: unknown = {}) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  const p = await addProvider({ kind: "mock" });
  await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
});

test("soul route refuses before five answers unless skip", async () => {
  const b = await createBot({ name: "Early", job: "Helps", avatar });
  expect((await post(b.id)).status).toBe(409);
  const skipped = await post(b.id, { skip: true });
  expect(skipped.status).toBe(200);
  expect(await skipped.json()).toMatchObject({ interview: "skipped" });
  expect((await getBot(b.id))?.soul).toContain("## Always ask first");
});

test("after five answers the bot writes its soul", async () => {
  const b = await createBot({ name: "Done", job: "Helps", avatar });
  for (let i = 1; i <= 5; i++) {
    await applyIncoming(b.id, { id: `${b.id}-u${i}`, role: "user", parts: [{ type: "text", text: `answer ${i}` }] }, "submit-message");
    await saveAssistant(b.id, { id: `${b.id}-a${i}`, role: "assistant", parts: [{ type: "text", text: `Question ${i + 1}` }] });
  }
  const res = await post(b.id);
  expect(res.status).toBe(200);
  const bot = await res.json();
  expect(bot.interview).toBe("done");
  expect(bot.soul).toContain("## Personality");
});
