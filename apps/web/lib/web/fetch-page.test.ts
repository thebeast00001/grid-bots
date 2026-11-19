import http from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { isPublicAddress } from "./address";
import { fetchPage, type LookupFn } from "./fetch-page";

/** A local server standing in for websites; test hosts resolve to it. */
let server: http.Server;
let port = 0;
const hits: string[] = [];
beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(`${req.headers.host}${req.url}`);
    const url = req.url ?? "/";
    if (url === "/ok") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<title>Ok</title><p>Hello</p>");
    if (url === "/redir-blocked") return res.writeHead(302, { location: `http://blocked.test:${port}/secret` }).end();
    if (url === "/redir-metadata") return res.writeHead(301, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    if (url === "/redir-relative") return res.writeHead(302, { location: "/ok" }).end();
    if (url.startsWith("/loop/")) return res.writeHead(302, { location: `/loop/${Number(url.slice(6)) + 1}` }).end();
    if (url === "/big") {
      res.writeHead(200, { "content-type": "text/plain" });
      for (let i = 0; i < 20; i++) res.write("x".repeat(100));
      return res.end();
    }
    if (url === "/big-declared") return res.writeHead(200, { "content-type": "text/plain", "content-length": "999999999" }).end();
    if (url === "/slow") return; // never answers
    if (url === "/gzip") return res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" }).end(gzipSync("unzipped text"));
    if (url === "/pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.7");
    if (url === "/latin1") return res.writeHead(200, { "content-type": "text/plain; charset=iso-8859-1" }).end(Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    res.writeHead(404).end("nope");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => (hits.length = 0));

let lookups = 0;
/** Every *.test host resolves to the local server. */
const lookup: LookupFn = async (host) => {
  lookups++;
  if (host === "split.test") return [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }];
  return [{ address: "127.0.0.1", family: 4 }];
};
/** Only a.test may reach the local server; everything else follows the real rule. */
const allow = (ip: string, host: string) => host === "a.test" || isPublicAddress(ip);
const at = (path: string, host = "a.test") => `http://${host}:${port}${path}`;

test("reads a page, connecting to the address it checked", async () => {
  lookups = 0;
  const r = await fetchPage(at("/ok"), { lookup, allow });
  expect(r).toMatchObject({ ok: true, url: at("/ok"), contentType: "text/html" });
  expect(r.ok && r.body).toContain("Hello");
  // One lookup, and Node didn't resolve a.test itself (it can't: it isn't a real name).
  expect(lookups).toBe(1);
});

test.each(["file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)", "data:text/html,hi", "not a url"])("refuses %s", async (url) => {
  const r = await fetchPage(url, { lookup, allow });
  expect(r.ok).toBe(false);
});

test("refuses a host that resolves to a private address, without connecting", async () => {
  const r = await fetchPage(at("/ok", "b.test"), { lookup });
  expect(r).toEqual({ ok: false, error: "That address isn't on the public internet." });
  expect(hits).toEqual([]);
});

test("refuses a host when any of its addresses is private", async () => {
  expect(await fetchPage(at("/ok", "split.test"), { lookup })).toMatchObject({ ok: false });
});

test("refuses private IP literals", async () => {
  expect(await fetchPage(`http://127.0.0.1:${port}/ok`, { lookup })).toMatchObject({ ok: false });
  expect(await fetchPage(`http://[::1]:${port}/ok`, { lookup })).toMatchObject({ ok: false });
  expect(hits).toEqual([]);
});

test("re-checks every redirect", async () => {
  expect(await fetchPage(at("/redir-blocked"), { lookup, allow })).toEqual({ ok: false, error: "That address isn't on the public internet." });
  expect(await fetchPage(at("/redir-metadata"), { lookup, allow })).toMatchObject({ ok: false });
  expect(hits.some((h) => h.includes("/secret"))).toBe(false);
  expect(await fetchPage(at("/redir-relative"), { lookup, allow })).toMatchObject({ ok: true, url: at("/ok") });
});

test("gives up after 5 redirects", async () => {
  expect(await fetchPage(at("/loop/0"), { lookup, allow })).toEqual({ ok: false, error: "The page redirected too many times." });
  expect(await fetchPage(at("/loop/1"), { lookup, allow, maxRedirects: 5 })).toMatchObject({ ok: false });
});

test("stops reading past the size cap", async () => {
  expect(await fetchPage(at("/big"), { lookup, allow, maxBytes: 1000 })).toEqual({ ok: false, error: "The page is too big to read." });
  expect(await fetchPage(at("/big-declared"), { lookup, allow })).toEqual({ ok: false, error: "The page is too big to read." });
  expect(await fetchPage(at("/big"), { lookup, allow, maxBytes: 5000 })).toMatchObject({ ok: true });
});

test("gives up on a slow server", async () => {
  expect(await fetchPage(at("/slow"), { lookup, allow, timeoutMs: 300 })).toEqual({ ok: false, error: "The page took too long to answer." });
});

test("decodes gzip and the declared charset", async () => {
  expect(await fetchPage(at("/gzip"), { lookup, allow })).toMatchObject({ ok: true, body: "unzipped text" });
  expect(await fetchPage(at("/latin1"), { lookup, allow })).toMatchObject({ ok: true, body: "café" });
});

test("says which files it can't read, and passes on error statuses", async () => {
  expect(await fetchPage(at("/pdf"), { lookup, allow })).toEqual({ ok: false, error: "Grid can't read PDF files yet." });
  expect(await fetchPage(at("/missing"), { lookup, allow })).toEqual({ ok: false, error: "The page wasn't found (404)." });
});

test("an unknown host is reported plainly", async () => {
  const none: LookupFn = async () => {
    throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
  };
  expect(await fetchPage("https://no-such-site.test/", { lookup: none })).toEqual({ ok: false, error: "Couldn't find no-such-site.test." });
});
