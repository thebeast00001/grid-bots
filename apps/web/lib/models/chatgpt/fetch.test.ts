import { chatgptFetch, rewriteResponsesBody } from "./fetch";

afterEach(() => vi.unstubAllGlobals());

test("rewriteResponsesBody forces store/stream, strips forbidden fields, maps system→developer", () => {
  const out = rewriteResponsesBody({
    model: "m",
    temperature: 0.3,
    top_p: 1,
    max_output_tokens: 10,
    previous_response_id: "r",
    input: [{ role: "system", content: "x" }, { role: "user", content: "hi" }],
  });
  expect(out).toEqual({
    model: "m",
    store: false,
    stream: true,
    input: [
      { role: "developer", content: "x" },
      { role: "user", content: "hi" },
    ],
  });
});

test("chatgptFetch adds the bearer token and rewrites JSON bodies", async () => {
  const f = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", f);
  const doFetch = chatgptFetch(async () => "tok");
  await doFetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: "Bearer placeholder", "content-type": "application/json" },
    body: JSON.stringify({ model: "m", temperature: 1 }),
  });
  const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
  expect(JSON.parse(String(init.body))).toEqual({ model: "m", store: false, stream: true });
});

test("chatgptFetch turns a plan-limit response into a Manage usage error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: { code: "subscription_sharing_usage_limit_exceeded" } }, { status: 429 })),
  );
  await expect(chatgptFetch(async () => "t")("https://api.openai.com/v1/responses", { method: "POST", body: "{}" })).rejects.toMatchObject({
    code: "limit",
  });
});
