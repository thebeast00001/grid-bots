import { createBot } from "@/lib/bots/repo";
import { applyIncoming } from "@/lib/chat/history";
import { resetDbForTests } from "@/lib/db/client";
import { useTempHome } from "@/lib/test-home";
import { GET as getMessages } from "../bots/[id]/messages/route";
import { PATCH as patchMessage } from "../messages/[id]/route";
import { GET as getFile } from "./[id]/route";
import { POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

const avatar = { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" } as const;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("upload a file, then download it", async () => {
  const b = await createBot({ name: "Up", job: "", avatar });
  const form = new FormData();
  form.set("botId", b.id);
  form.set("file", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
  const res = await POST(new Request("http://x/api/files", { method: "POST", body: form }));
  expect(res.status).toBe(201);
  const up = await res.json();
  const file = await getFile(new Request("http://x"), ctx(up.id));
  expect(file.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

test("unknown files are 404", async () => {
  expect((await getFile(new Request("http://x"), ctx("file_0000000000000000"))).status).toBe(404);
  expect((await getFile(new Request("http://x"), ctx("../../master.key"))).status).toBe(404);
});

test("list a thread and react to a message", async () => {
  const b = await createBot({ name: "React", job: "", avatar });
  await applyIncoming(b.id, { id: "r1", role: "user", parts: [{ type: "text", text: "hi" }] }, "submit-message");
  const patched = await patchMessage(new Request("http://x", { method: "PATCH", body: JSON.stringify({ reaction: "❤️" }) }), ctx("r1"));
  expect(patched.status).toBe(200);
  const thread = await (await getMessages(new Request("http://x"), ctx(b.id))).json();
  expect(thread.messages[0].metadata.reaction).toBe("❤️");
  await patchMessage(new Request("http://x", { method: "PATCH", body: JSON.stringify({ reaction: null }) }), ctx("r1"));
  const after = await (await getMessages(new Request("http://x"), ctx(b.id))).json();
  expect(after.messages[0].metadata.reaction).toBeUndefined();
});
