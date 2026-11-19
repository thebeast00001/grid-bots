import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/** A web page as a bot reads it: its title, its main text, and where it links. */
export type Extracted = { title: string; text: string; links: { text: string; url: string }[] };

const MAX_LINKS = 30;
const BLOCK = new Set(["P", "DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE", "BLOCKQUOTE", "PRE", "UL", "OL", "TABLE", "TR", "FIGURE", "FIGCAPTION", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "DL", "DT", "DD"]);
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME", "CANVAS", "BUTTON", "FORM", "SELECT"]);

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Text with paragraph breaks kept (textContent would run them together). */
function textOf(root: Node): string {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      out.push(n.textContent ?? "");
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName.toUpperCase();
    if (SKIP.has(tag)) return;
    if (tag === "BR") return void out.push("\n");
    if (tag === "LI") out.push("\n- ");
    else if (BLOCK.has(tag)) out.push("\n\n");
    n.childNodes.forEach(walk);
    if (BLOCK.has(tag)) out.push("\n\n");
  };
  walk(root);
  return out
    .join("")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^- *$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function links(document: Document, base: string): Extracted["links"] {
  const seen = new Set<string>();
  const out: Extracted["links"] = [];
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    if (out.length >= MAX_LINKS) break;
    let u: URL;
    try {
      u = new URL(a.getAttribute("href") ?? "", base);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    u.hash = "";
    if (seen.has(u.href)) continue;
    seen.add(u.href);
    out.push({ text: squash(a.textContent ?? "").slice(0, 100) || u.hostname, url: u.href });
  }
  return out;
}

export function extractPage(html: string, url: string): Extracted {
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content") ?? "";
  const title = squash(document.querySelector("title")?.textContent ?? "") || squash(meta('meta[property="og:title"]'));

  let text = "";
  try {
    // Readability changes the document it reads, so it gets its own copy.
    const article = new Readability(parseHTML(html).document as unknown as Document, { charThreshold: 200 }).parse();
    if (article?.content) {
      const body = parseHTML(`<html><body>${article.content}</body></html>`).document.body;
      const t = textOf(body);
      if (t.length >= 200) text = t;
    }
  } catch {
    // Some pages trip Readability up; the plain text below still works.
  }
  if (!text) {
    document.querySelectorAll("nav, footer, header, aside, [role=navigation], [aria-hidden=true]").forEach((n) => n.remove());
    text = document.body ? textOf(document.body) : "";
  }
  return { title, text, links: links(document as unknown as Document, url) };
}
