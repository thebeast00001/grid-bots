import { checkRequest } from "./guard";

const h = (o: Record<string, string>) => new Headers(o);

test("allows same-origin POST with x-grid", () => {
  const r = checkRequest({ method: "POST", port: 3210, headers: h({ host: "127.0.0.1:3210", origin: "http://127.0.0.1:3210", "x-grid": "1" }) });
  expect(r.ok).toBe(true);
});

test("blocks DNS-rebinding host", () => {
  expect(checkRequest({ method: "GET", port: 3210, headers: h({ host: "evil.example:3210" }) })).toEqual({ ok: false, reason: "host" });
});

test("blocks a localhost host on a different port", () => {
  expect(checkRequest({ method: "GET", port: 3210, headers: h({ host: "localhost:8080" }) })).toEqual({ ok: false, reason: "host" });
});

test("blocks foreign origin", () => {
  const r = checkRequest({ method: "POST", port: 3210, headers: h({ host: "127.0.0.1:3210", origin: "https://evil.example", "x-grid": "1" }) });
  expect(r).toEqual({ ok: false, reason: "origin" });
});

test("blocks the opaque null origin", () => {
  const r = checkRequest({ method: "POST", port: 3210, headers: h({ host: "127.0.0.1:3210", origin: "null", "x-grid": "1" }) });
  expect(r).toEqual({ ok: false, reason: "origin" });
});

test("blocks POST without x-grid", () => {
  expect(checkRequest({ method: "POST", port: 3210, headers: h({ host: "localhost:3210" }) })).toEqual({ ok: false, reason: "header" });
});

test("allows plain GET from the app", () => {
  expect(checkRequest({ method: "GET", port: 3210, headers: h({ host: "localhost:3210" }) }).ok).toBe(true);
});

test("allows IPv6 loopback", () => {
  expect(checkRequest({ method: "GET", port: 3210, headers: h({ host: "[::1]:3210" }) }).ok).toBe(true);
});
