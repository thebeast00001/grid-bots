import { HttpStatus } from "../http";
import { mockAllowed, type ProviderKind } from "../models/kinds";
import { deleteSetting, getSetting, setSetting } from "../settings";
import { seal, unseal } from "../vault";
import { FIXTURES } from "./fixtures";
import { siteOf } from "./read-page";

/**
 * Web search for bots through a service the user picks in Settings → Web: Brave Search,
 * Tavily, or their own SearXNG. The key is sealed in the vault and never leaves the server.
 */

export const SEARCH_KINDS = ["brave", "tavily", "searxng", "test"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export const SEARCH_LABELS: Record<SearchKind, string> = { brave: "Brave Search", tavily: "Tavily", searxng: "SearXNG", test: "Test search" };

export type SearchResult = { title: string; url: string; site: string; snippet: string };
export type SearchOutcome = { ok: true; results: SearchResult[] } | { ok: false; error: string };
export type SearchServiceView = { kind: SearchKind; url?: string; hasKey: boolean };

type Stored = { kind: SearchKind; key?: string; url?: string };

const MAX_RESULTS = 8;
const KEY = /^\S{8,200}$/;

/** Models that search the web on their own (used when no service is set). */
export function builtInSearch(kind: ProviderKind): { label: string } | null {
  if (kind === "chatgpt") return { label: "ChatGPT's own search" };
  if (kind === "openai") return { label: "OpenAI's own search" };
  if (kind === "anthropic") return { label: "Claude's own search" };
  return null;
}

export async function getSearchService(): Promise<SearchServiceView | null> {
  const s = await getSetting<Stored>("searchService");
  if (!s || (s.kind === "test" && !mockAllowed())) return null;
  return { kind: s.kind, ...(s.url ? { url: s.url } : {}), hasKey: !!s.key };
}

const bad = (message: string) => new HttpStatus(400, "bad-request", message);

/** Saves the service. A key that isn't sent again is kept (if it's for the same service). */
export async function setSearchService(input: { kind: SearchKind; key?: string; url?: string } | null): Promise<void> {
  if (!input) return deleteSetting("searchService");
  const { kind } = input;
  if (!SEARCH_KINDS.includes(kind) || (kind === "test" && !mockAllowed())) throw bad("Unknown search service.");
  const label = SEARCH_LABELS[kind];
  const next: Stored = { kind };
  if (kind === "brave" || kind === "tavily") {
    const key = input.key?.trim();
    if (key) {
      if (!KEY.test(key)) throw bad(`That doesn't look like a key for ${label}.`);
      next.key = await seal(key);
    } else {
      const old = await getSetting<Stored>("searchService");
      if (old?.kind !== kind || !old.key) throw bad(`${label} needs a key.`);
      next.key = old.key;
    }
  }
  if (kind === "searxng") {
    const raw = input.url?.trim();
    if (!raw) throw bad("Add your SearXNG address.");
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      throw bad("That SearXNG address isn't a web address.");
    }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || raw.length > 500) throw bad("Use an http or https address for SearXNG.");
    next.url = u.href.replace(/\/+$/, "");
  }
  await setSetting("searchService", next);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
/** Search snippets come with bits of HTML; the bot gets plain text. */
const plain = (s: unknown) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();

function clean(raw: { title?: unknown; url?: unknown; snippet?: unknown }[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const r of raw) {
    if (out.length >= MAX_RESULTS) break;
    let u: URL;
    try {
      u = new URL(String(r.url));
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    const site = siteOf(u.href);
    out.push({ title: plain(r.title).slice(0, 200) || site, url: u.href, site, snippet: plain(r.snippet).slice(0, 300) });
  }
  return out;
}

function testSearch(query: string): SearchOutcome {
  if (/fail/i.test(query)) return { ok: false, error: "Test search is down." };
  if (/nothing/i.test(query)) return { ok: true, results: [] };
  const paths = ["/guide", "/pricing", "/hindi", "/long-title", "/slow", "/broken"];
  return {
    ok: true,
    // A "deep" query gets its own addresses, so several searches can fill a reply with sources.
    results: paths.map((p) => ({
      title: FIXTURES[p].title || "Broken page",
      url: `https://grid.test${p}${/deep/i.test(query) ? `?q=${encodeURIComponent(query)}` : ""}`,
      site: "grid.test",
      snippet: `About ${query}: a page on the Grid test site.`,
    })),
  };
}

export async function search(query: string, o: { fetch?: typeof fetch } = {}): Promise<SearchOutcome> {
  const s = await getSetting<Stored>("searchService");
  if (!s || (s.kind === "test" && !mockAllowed())) return { ok: false, error: "No search service is set up. The user can add one in Settings → Web." };
  if (s.kind === "test") return testSearch(query);
  const label = SEARCH_LABELS[s.kind];
  const f = o.fetch ?? fetch;
  const signal = AbortSignal.timeout(10_000);
  const q = new URLSearchParams({ q: query });
  let res: Response;
  try {
    if (s.kind === "brave") {
      res = await f(`https://api.search.brave.com/res/v1/web/search?${q}&count=${MAX_RESULTS}`, {
        headers: { accept: "application/json", "x-subscription-token": await unseal(s.key ?? "") },
        signal,
      });
    } else if (s.kind === "tavily") {
      res = await f("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await unseal(s.key ?? "")}` },
        body: JSON.stringify({ query, max_results: MAX_RESULTS }),
        signal,
      });
    } else {
      res = await f(`${s.url}/search?${q}&format=json`, { headers: { accept: "application/json" }, signal });
    }
  } catch {
    return { ok: false, error: `Couldn't reach ${label}.` };
  }
  if (s.kind === "searxng" && res.status === 403) return { ok: false, error: "SearXNG refused. Turn on the json format in its settings.yml (search → formats)." };
  if (res.status === 401 || res.status === 403) return { ok: false, error: `${label} says the key isn't valid. Check it in Settings → Web.` };
  if (res.status === 429) return { ok: false, error: `${label} says you're over your limit for now.` };
  if (!res.ok) return { ok: false, error: `${label} had a problem (${res.status}).` };
  let body: { web?: { results?: unknown[] }; results?: unknown[] };
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `${label} sent something Grid couldn't read.` };
  }
  type Raw = { title?: unknown; url?: unknown; description?: unknown; content?: unknown };
  const raw = ((s.kind === "brave" ? body.web?.results : body.results) ?? []) as Raw[];
  return { ok: true, results: clean(raw.map((r) => ({ title: r.title, url: r.url, snippet: r.description ?? r.content }))) };
}
