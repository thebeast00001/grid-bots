import { ApiError, api } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

test("api sends x-grid and JSON headers and parses the reply", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const out = await api<{ ok: number }>("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
  expect(out).toEqual({ ok: 1 });
  const headers = new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
  expect(headers.get("x-grid")).toBe("1");
  expect(headers.get("content-type")).toBe("application/json");
});

test("api throws ApiError with the server's error body", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "auth" } }), { status: 401 })));
  await expect(api("/api/x")).rejects.toMatchObject({ status: 401, body: { error: { code: "auth" } } });
  await expect(api("/api/x")).rejects.toBeInstanceOf(ApiError);
});
