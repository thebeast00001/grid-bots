import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Streamdown } from "streamdown";
import { citeComponents, citeComponentsFor } from "./source-chips";
import { citeLinks, type Source } from "./sources";

const sources: Source[] = [{ n: 1, url: "https://grid.test/guide", title: "Guide", site: "grid.test", read: true }];

test("citations render as links to their source through the real markdown renderer", () => {
  const html = renderToString(createElement(Streamdown, { components: citeComponents(sources) }, citeLinks("Answer [1].", sources)));
  expect(html).toContain('data-testid="cite"');
  expect(html).toContain('href="https://grid.test/guide"');
  expect(html).toContain('rel="noopener noreferrer"');
});

test("the same sources reuse one set of markdown components, and no sources means none at all", () => {
  expect(citeComponentsFor([])).toBeUndefined();
  const a = citeComponentsFor(sources);
  expect(a).toBeDefined();
  expect(citeComponentsFor(sources.map((s) => ({ ...s })))).toBe(a);
  expect(citeComponentsFor([{ ...sources[0], url: "https://other.example/" }])).not.toBe(a);
});
