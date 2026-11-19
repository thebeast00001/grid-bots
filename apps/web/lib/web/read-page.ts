import { mockAllowed } from "../models/kinds";
import { extractPage } from "./extract";
import { fetchPage as realFetchPage, type FetchResult } from "./fetch-page";
import { fixturePage } from "./fixtures";

/** A page as the bot gets it. */
export type PageRead =
  | { ok: true; url: string; title: string; site: string; text: string; truncated: boolean; links: { text: string; url: string }[] }
  | { ok: false; error: string };

export const MAX_PAGE_CHARS = 12_000;

export const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function clip(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const at = cut.search(/\s\S*$/);
  return { text: (at > max * 0.8 ? cut.slice(0, at) : cut).trimEnd(), truncated: true };
}

export async function readPage(url: string, o: { fetchPage?: (url: string) => Promise<FetchResult> } = {}): Promise<PageRead> {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // fetchPage explains a bad address.
  }
  const res = mockAllowed() && host === "grid.test" ? await fixturePage(new URL(url)) : await (o.fetchPage ?? realFetchPage)(url);
  if (!res.ok) return res;
  const site = siteOf(res.url);
  const html = res.contentType === "text/html" || res.contentType === "application/xhtml+xml";
  const page = html ? extractPage(res.body, res.url) : { title: "", text: res.body.trim(), links: [] };
  return { ok: true, url: res.url, title: page.title || site, site, ...clip(page.text, MAX_PAGE_CHARS), links: page.links };
}
