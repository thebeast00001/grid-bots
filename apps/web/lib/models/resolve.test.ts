import { streamText } from "ai";
import { resetDbForTests } from "../db/client";
import { deleteSetting, setSetting } from "../settings";
import { useTempHome } from "../test-home";
import { addProvider } from "./providers-repo";
import { resolveModel } from "./resolve";

useTempHome();
afterAll(() => resetDbForTests());

test("resolveModel with nothing connected throws no-model with a way out", async () => {
  await expect(resolveModel(null)).rejects.toMatchObject({ code: "no-model", action: { href: "/welcome" } });
});

test("resolveModel falls back to the default model", async () => {
  const p = await addProvider({ kind: "mock" });
  await setSetting("defaultModel", { providerId: p.id, modelId: "mock-chat" });
  const r = await resolveModel(null);
  expect(r).toMatchObject({ ref: { providerId: p.id, modelId: "mock-chat" }, tools: true, kind: "mock" });
  const result = streamText({ model: r.model, prompt: "hi" });
  expect(await result.text).toBe("You said: hi");
});

test("a bot model whose provider was removed falls back to the default", async () => {
  const r = await resolveModel({ providerId: "gone", modelId: "x" });
  expect(r.kind).toBe("mock");
});

test("with a model connected but no default, the error points to Settings, not Connect", async () => {
  await deleteSetting("defaultModel");
  await expect(resolveModel(null)).rejects.toMatchObject({ code: "no-model", action: { href: "/settings/models" } });
  await expect(resolveModel({ providerId: "gone", modelId: "x" })).rejects.toMatchObject({ action: { href: "/settings/models" } });
});
