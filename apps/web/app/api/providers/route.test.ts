import { resetDbForTests } from "@/lib/db/client";
import { useTempHome } from "@/lib/test-home";
import { GET as getSettings, PATCH as patchSettings } from "../settings/route";
import { DELETE as deleteProvider } from "./[id]/route";
import { GET as getModels } from "./[id]/models/route";
import { GET, POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const post = (body: unknown) => new Request("http://127.0.0.1:3210/api/providers", { method: "POST", body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("add, list, list models, set default, remove", async () => {
  const created = await POST(post({ kind: "mock" }));
  expect(created.status).toBe(201);
  const p = await created.json();
  expect(p).toMatchObject({ kind: "mock", label: "Test model" });

  const list = await (await GET()).json();
  expect(list.providers.map((x: { id: string }) => x.id)).toContain(p.id);
  expect(list.kinds.some((k: { kind: string }) => k.kind === "mock")).toBe(true);

  const models = await (await getModels(new Request("http://x"), ctx(p.id))).json();
  expect(models.models[0].id).toBe("mock-chat");

  // The first provider's first model became the default.
  expect((await (await getSettings()).json()).defaultModel).toEqual({ providerId: p.id, modelId: "mock-chat" });

  const patched = await patchSettings(
    new Request("http://x", { method: "PATCH", body: JSON.stringify({ defaultModel: { providerId: p.id, modelId: "other" } }) }),
  );
  expect((await patched.json()).defaultModel.modelId).toBe("other");

  expect((await deleteProvider(new Request("http://x", { method: "DELETE" }), ctx(p.id))).status).toBe(204);
  expect((await (await GET()).json()).providers).toEqual([]);
});

test("unknown kinds are rejected with a typed error", async () => {
  const res = await POST(post({ kind: "nope" }));
  expect(res.status).toBe(400);
  expect((await res.json()).error.code).toBe("unsupported");
});
