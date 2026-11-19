import type { UIMessage } from "ai";

/**
 * The links a bot may open with read_page. Any page on a site the user named (by link or bare
 * domain), and exactly the links that came from search results, sources, or pages already
 * read. A web page can tell the bot to open a link it makes up, for example one carrying the
 * user's details, but that link won't be on this list.
 */

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
// A bare domain such as "deals.example.org" (not inside a URL, not an email address).
const DOMAIN_IN_TEXT = /(?<![@/\w.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi;

const host = (h: string) => h.toLowerCase().replace(/^www\./, "");

function exact(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

type Out = { url?: unknown; links?: { url?: unknown }[]; results?: { url?: unknown }[] };

export function knownLinks(thread: UIMessage[]) {
  const hosts = new Set<string>();
  const urls = new Set<string>();
  const add = (url: unknown) => {
    const e = typeof url === "string" ? exact(url) : null;
    if (e) urls.add(e);
  };

  for (const m of thread) {
    for (const p of m.parts) {
      if (m.role === "user" && p.type === "text") {
        for (const u of p.text.match(URL_IN_TEXT) ?? []) {
          const e = exact(u.replace(/[.,;:!?]+$/, ""));
          if (e) hosts.add(host(new URL(e).hostname));
        }
        for (const d of p.text.replace(URL_IN_TEXT, " ").match(DOMAIN_IN_TEXT) ?? []) hosts.add(host(d));
      }
      if (m.role !== "assistant") continue;
      if (p.type === "source-url") add(p.url);
      if ((p.type === "tool-web_search" || p.type === "tool-read_page") && "output" in p && p.state === "output-available") {
        const o = (p.output ?? {}) as Out;
        add(o.url);
        o.links?.forEach((l) => add(l.url));
        o.results?.forEach((r) => add(r.url));
      }
    }
  }

  return {
    add,
    allows(url: string): boolean {
      const e = exact(url);
      if (!e) return false;
      return urls.has(e) || hosts.has(host(new URL(e).hostname));
    },
  };
}
