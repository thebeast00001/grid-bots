import { resetDbForTests } from "@/lib/db/client";
import { AUTHORIZE_URL } from "@/lib/models/chatgpt/oauth";
import { useTempHome } from "@/lib/test-home";
import { POST } from "./route";

useTempHome();
afterAll(() => resetDbForTests());

test("start returns an OpenAI authorize URL with a loopback redirect", async () => {
  const res = await POST(new Request("http://127.0.0.1:3210/api/providers/chatgpt/start", { method: "POST" }));
  expect(res.status).toBe(200);
  const { authorizeUrl } = await res.json();
  const u = new URL(authorizeUrl);
  expect(u.origin + u.pathname).toBe(AUTHORIZE_URL);
  expect(u.searchParams.get("redirect_uri")).toMatch(/^http:\/\/127\.0\.0\.1:14(5[5-9]|60)\/auth\/callback$/);
});
