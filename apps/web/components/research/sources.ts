import type { UIMessage } from "ai";

/** What a reply's research looks like on screen: its steps, its sources, and citation links. */

type Parts = UIMessage["parts"];
type ToolPart = { type: string; state?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; providerExecuted?: boolean };

export type Source = { n: number; url: string; title: string; site: string; read: boolean };
export type Step =
  | { kind: "search"; query: string; state: "running" | "done" | "failed"; count?: number; error?: string }
  | { kind: "read"; url: string; site: string; title?: string; state: "running" | "done" | "failed"; error?: string };

export const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Only web links become chips or citations (never javascript:, data: and the like). */
const isWeb = (url: unknown): url is string => typeof url === "string" && /^https?:\/\//i.test(url);

const done = (p: ToolPart) => p.state === "output-available";
const failedState = (p: ToolPart) => p.state === "output-error";

export function sourcesOf(parts: Parts): Source[] {
  const byUrl = new Map<string, Source>();
  const put = (s: Source) => {
    if (!isWeb(s.url)) return;
    const had = byUrl.get(s.url);
    if (!had) byUrl.set(s.url, s);
    else if (s.read && !had.read) byUrl.set(s.url, { ...had, title: s.title || had.title, read: true });
  };
  const own: { url: string; title?: string }[] = [];
  for (const raw of parts) {
    const p = raw as ToolPart & { url?: string; title?: string };
    if (p.type === "source-url" && isWeb(p.url)) own.push({ url: p.url, title: p.title });
    if (!done(p) || !p.output || p.providerExecuted) continue;
    const o = p.output as { ok?: boolean; n?: number; url?: string; title?: string; site?: string; results?: Source[] };
    if (p.type === "tool-web_search" && o.ok) o.results?.forEach((r) => put({ n: r.n, url: r.url, title: r.title, site: r.site, read: false }));
    if (p.type === "tool-read_page" && o.ok && o.n && o.url) put({ n: o.n, url: o.url, title: o.title ?? siteOf(o.url), site: o.site ?? siteOf(o.url), read: true });
  }
  let next = Math.max(0, ...[...byUrl.values()].map((s) => s.n)) + 1;
  for (const s of own) if (!byUrl.has(s.url)) byUrl.set(s.url, { n: next++, url: s.url, title: s.title || siteOf(s.url), site: siteOf(s.url), read: true });
  return [...byUrl.values()].sort((a, b) => a.n - b.n);
}

/** Text outside code: fenced blocks and `inline code` are left alone. */
function outsideCode(text: string, fn: (plain: string) => string): string {
  return text
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((chunk, i) => (i % 2 ? chunk : fn(chunk)))
    .join("");
}

const CITE = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\](?!\()/g;

export function citedNumbers(text: string): Set<number> {
  const out = new Set<number>();
  outsideCode(text, (plain) => {
    for (const m of plain.matchAll(CITE)) m[1].split(",").forEach((n) => out.add(Number(n.trim())));
    return plain;
  });
  return out;
}

/** The chips under a reply: pages it read, plus search results it cited. */
export function shownSources(all: Source[], text: string): Source[] {
  const cited = citedNumbers(text);
  return all.filter((s) => s.read || cited.has(s.n));
}

/** "[1][2]" → markdown links the message renderer turns into citation chips. */
export function citeLinks(text: string, all: Source[]): string {
  const known = new Set(all.map((s) => s.n));
  return outsideCode(text, (plain) =>
    plain.replace(CITE, (whole, list: string) => {
      const ns = list.split(",").map((n) => Number(n.trim()));
      if (!ns.every((n) => known.has(n))) return whole;
      return ns.map((n) => `[${n}](#cite-${n})`).join("");
    }),
  );
}

export function stepsOf(parts: Parts): Step[] {
  const steps: Step[] = [];
  for (const raw of parts) {
    const p = raw as ToolPart;
    const state = done(p) ? "done" : failedState(p) ? "failed" : "running";
    const out = (p.output ?? {}) as { ok?: boolean; error?: string; results?: unknown[]; title?: string; action?: { query?: string } };
    if (p.type === "tool-web_search") {
      const query = String(p.input?.query ?? out.action?.query ?? "");
      if (state === "done" && out.ok === false) steps.push({ kind: "search", query, state: "failed", error: out.error });
      else if (state === "done" && !p.providerExecuted) steps.push({ kind: "search", query, state, count: out.results?.length ?? 0 });
      else steps.push({ kind: "search", query, state });
    }
    if (p.type === "tool-read_page") {
      const url = String(p.input?.url ?? "");
      const base = { kind: "read" as const, url, site: siteOf(url) };
      if (state === "done" && out.ok === false) steps.push({ ...base, state: "failed", error: out.error });
      else if (state === "done") steps.push({ ...base, title: out.title, state });
      else steps.push({ ...base, state });
    }
  }
  return steps;
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const pages = (n: number) => (n === 1 ? "1 page" : `${n} pages`);

/** "Searched once · read 2 pages" */
export function summary(steps: Step[]): string {
  const count = (kind: Step["kind"], ok: boolean) => steps.filter((s) => s.kind === kind && (ok ? s.state !== "failed" : s.state === "failed")).length;
  const [searches, badSearches, reads, badReads] = [count("search", true), count("search", false), count("read", true), count("read", false)];
  if (badSearches && !searches && !reads && !badReads) return badSearches === 1 ? "Search failed" : `${badSearches} searches failed`;
  const bits = [
    searches ? `searched ${times(searches)}` : "",
    badSearches ? `${badSearches} ${badSearches === 1 ? "search" : "searches"} failed` : "",
    reads ? `read ${pages(reads)}` : "",
    badReads ? `${badReads} couldn't be read` : "",
  ].filter(Boolean);
  const line = bits.join(" · ") || "looked on the web";
  return line[0].toUpperCase() + line.slice(1);
}
