import { extractPage } from "./extract";
import { readPage } from "./read-page";

const article = `<!doctype html><html><head><title>Cafés in Pune — City Guide</title>
<script>window.track = "secret-tracker"</script><style>.x { color: red }</style></head>
<body>
<nav><a href="/">Home</a> <a href="/about">About</a></nav>
<article>
<h1>The quiet cafés of Pune</h1>
<p>Pune has a café on every corner, but only a few are quiet enough to work in. This guide lists the ones locals recommend for long afternoons with a laptop.</p>
<p>Our favourite is <a href="/cafes/vohuman">Vohuman</a>, a tiny Irani café that has served the same breakfast since 1978. Arrive before nine for a table.</p>
<p>For a bigger space, try <a href="https://example.org/pagdandi?ref=guide#top">Pagdandi Books Chai Café</a>, where you can read while you wait.</p>
<p>Avoid weekends: most of these places fill up with families by eleven in the morning. Weekdays are calm until lunch.</p>
<p><a href="javascript:alert(1)">Click me</a> <a href="mailto:hi@example.org">Mail us</a> <a href="/cafes/vohuman">Vohuman again</a></p>
</article>
<footer>© City Guide · <a href="/privacy">Privacy</a></footer>
</body></html>`;

test("keeps the title and the article, drops scripts, styles and navigation", () => {
  const p = extractPage(article, "https://guide.example.com/pune/cafes");
  expect(p.title).toBe("Cafés in Pune — City Guide");
  expect(p.text).toContain("only a few are quiet enough to work in");
  expect(p.text).toContain("Arrive before nine");
  expect(p.text).not.toContain("secret-tracker");
  expect(p.text).not.toContain("color: red");
  expect(p.text).not.toMatch(/\n{3,}/);
});

test("links are absolute, http(s) only, without fragments, and listed once", () => {
  const p = extractPage(article, "https://guide.example.com/pune/cafes");
  const urls = p.links.map((l) => l.url);
  expect(urls).toContain("https://guide.example.com/cafes/vohuman");
  expect(urls).toContain("https://example.org/pagdandi?ref=guide");
  expect(urls.filter((u) => u.endsWith("/cafes/vohuman"))).toHaveLength(1);
  expect(urls.some((u) => /^(javascript|mailto):/.test(u))).toBe(false);
  expect(p.links.find((l) => l.url.endsWith("/vohuman"))?.text).toBe("Vohuman");
});

test("a page Readability can't use still gives its text", () => {
  const p = extractPage("<html><body><div>Just a line.</div><script>x()</script></body></html>", "https://a.example/");
  expect(p.text).toBe("Just a line.");
  expect(p.title).toBe("");
});

test("at most 30 links", () => {
  const many = `<title>Links</title><body>${Array.from({ length: 50 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join(" ")}</body>`;
  expect(extractPage(many, "https://a.example/").links).toHaveLength(30);
});

test("readPage serves the test site from fixtures in test mode", async () => {
  const r = await readPage("https://grid.test/guide");
  expect(r).toMatchObject({ ok: true, site: "grid.test", title: expect.stringContaining("Grid") });
  expect(r.ok && r.links.length).toBeGreaterThan(0);
  expect(await readPage("https://grid.test/nope")).toEqual({ ok: false, error: "The page wasn't found (404)." });
});

test("readPage never serves fixtures outside test mode", async () => {
  const fetchPage = vi.fn(async () => ({ ok: false as const, error: "network" }));
  const was = process.env.VITEST;
  process.env.VITEST = "";
  try {
    expect(await readPage("https://grid.test/guide", { fetchPage })).toEqual({ ok: false, error: "network" });
    expect(fetchPage).toHaveBeenCalledOnce();
  } finally {
    process.env.VITEST = was;
  }
});

test("readPage trims long text at a word and says so", async () => {
  const words = Array.from({ length: 4000 }, (_, i) => `word${i}`).join(" ");
  const fetchPage = async () => ({ ok: true as const, url: "https://a.example/t", contentType: "text/plain", body: words });
  const r = await readPage("https://a.example/t", { fetchPage });
  expect(r.ok && r.truncated).toBe(true);
  expect(r.ok && r.text.length).toBeLessThanOrEqual(12_000);
  expect(r.ok && r.text).toMatch(/word\d+$/);
  expect(r).toMatchObject({ site: "a.example", title: "a.example" });
});
