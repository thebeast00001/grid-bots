import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { isPublicAddress } from "./address";

/**
 * Fetches a web page for a bot, safely: http(s) only; every address the host resolves to must
 * be public (see address.ts), checked again on every redirect; the connection goes to the
 * address that was checked (so DNS can't swap in a private one afterwards); and size and time
 * are capped. Errors come back as plain sentences the bot can pass on.
 */

export type LookupFn = (host: string) => Promise<{ address: string; family: number }[]>;
export type FetchResult = { ok: true; url: string; contentType: string; body: string } | { ok: false; error: string };
export type FetchOptions = {
  lookup?: LookupFn;
  /** Tests let their own server through; everything else uses isPublicAddress. */
  allow?: (ip: string, host: string) => boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export const READABLE_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/json",
  "application/ld+json",
  "text/xml",
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
];

// Names Grid and nothing about the user.
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; Grid/1.0; open-source AI assistant)",
  accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.5",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "en",
};
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const NOT_PUBLIC = "That address isn't on the public internet.";

const fail = (error: string): FetchResult => ({ ok: false, error });

function typeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  const top = mime.split("/")[0];
  if (top === "image" || top === "video" || top === "audio") return top;
  return mime || "these";
}

function statusError(status: number): string {
  if (status === 404 || status === 410) return `The page wasn't found (${status}).`;
  if (status === 401 || status === 403) return `The site didn't let Grid in (${status}).`;
  if (status === 429) return "The site is limiting visits right now (429).";
  if (status >= 500) return `The site had a problem (${status}).`;
  return `The page answered ${status}.`;
}

function networkError(e: unknown, host: string): string {
  const code = (e as { code?: string }).code ?? "";
  if ((e as Error).name === "AbortError" || code === "ABORT_ERR") return "The page took too long to answer.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") return `Couldn't find ${host}.`;
  if (code.startsWith("CERT_") || code.startsWith("ERR_TLS") || code.includes("SELF_SIGNED") || code.includes("UNABLE_TO_VERIFY")) {
    return `${host}'s security certificate isn't valid.`;
  }
  return `Couldn't reach ${host}.`;
}

/** The charset the server declared, or the page's own <meta charset>, else UTF-8. */
function decode(buf: Buffer, mime: string, declared: string | undefined): string {
  let charset = declared;
  if (!charset && mime.includes("html")) charset = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(buf.subarray(0, 4096).toString("latin1"))?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

function open(u: URL, to: { address: string; family: number }, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, {
      method: "GET",
      headers: HEADERS,
      agent: false,
      signal,
      // Connect to the address that was checked, never a fresh lookup.
      lookup: ((_host: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) =>
        opts?.all ? cb(null, [{ address: to.address, family: to.family }]) : cb(null, to.address, to.family)) as never,
    });
    req.on("response", resolve);
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPage(url: string, o: FetchOptions = {}): Promise<FetchResult> {
  const lookup: LookupFn = o.lookup ?? ((h) => dnsLookup(h, { all: true, verbatim: true }));
  const allow = o.allow ?? ((ip: string) => isPublicAddress(ip));
  const maxBytes = o.maxBytes ?? 3 * 1024 * 1024;
  const maxRedirects = o.maxRedirects ?? 5;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), o.timeoutMs ?? 15_000);
  const aborted = new Promise<never>((_, reject) =>
    ac.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }),
  );
  aborted.catch(() => {});

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    clearTimeout(timer);
    return fail("That isn't a web address.");
  }
  let host = "";
  try {
    for (let hop = 0; ; hop++) {
      if (current.protocol !== "http:" && current.protocol !== "https:") return fail("Only http and https pages can be read.");
      if (current.username || current.password) return fail("Links with a username or password can't be opened.");
      host = current.hostname.replace(/^\[|\]$/g, "");
      const family = isIP(host);
      const addrs = family ? [{ address: host, family }] : await Promise.race([lookup(host), aborted]);
      if (!addrs.length || addrs.some((a) => !allow(a.address, host))) return fail(NOT_PUBLIC);

      const res = await Promise.race([open(current, addrs[0], ac.signal), aborted]);
      const status = res.statusCode ?? 0;
      if (REDIRECTS.has(status) && res.headers.location) {
        res.resume();
        if (hop >= maxRedirects) return fail("The page redirected too many times.");
        current = new URL(res.headers.location, current);
        continue;
      }
      if (status < 200 || status > 299) {
        res.resume();
        return fail(statusError(status));
      }
      const [rawMime, ...params] = (res.headers["content-type"] ?? "text/html").split(";");
      const mime = rawMime.trim().toLowerCase();
      if (!READABLE_TYPES.includes(mime)) {
        res.resume();
        return fail(`Grid can't read ${typeLabel(mime)} files yet.`);
      }
      if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
        res.destroy();
        return fail("The page is too big to read.");
      }
      const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const unzip = encoding.includes("gzip") ? zlib.createGunzip() : encoding === "deflate" ? zlib.createInflate() : encoding === "br" ? zlib.createBrotliDecompress() : null;
      const body: Readable = unzip ? res.pipe(unzip) : res;
      if (unzip) res.on("error", (e) => unzip.destroy(e));
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of body) {
        size += (chunk as Buffer).length;
        if (size > maxBytes) {
          res.destroy();
          return fail("The page is too big to read.");
        }
        chunks.push(chunk as Buffer);
      }
      const charset = params.map((p) => /charset\s*=\s*"?([\w-]+)/i.exec(p)?.[1]).find(Boolean);
      return { ok: true, url: current.href, contentType: mime, body: decode(Buffer.concat(chunks), mime, charset) };
    }
  } catch (e) {
    return fail(networkError(ac.signal.aborted ? Object.assign(new Error("aborted"), { name: "AbortError" }) : e, host));
  } finally {
    clearTimeout(timer);
  }
}
