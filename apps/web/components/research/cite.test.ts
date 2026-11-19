import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Streamdown } from "streamdown";
import { citeComponents } from "./source-chips";
import { citeLinks, type Source } from "./sources";

const sources: Source[] = [{ n: 1, url: "https://grid.test/guide", title: "Guide", site: "grid.test", read: true }];

test("citations render as links to their source through the real markdown renderer", () => {
  const html = renderToString(createElement(Streamdown, { components: citeComponents(sources) }, citeLinks("Answer [1].", sources)));
  expect(html).toContain('data-testid="cite"');
  expect(html).toContain('href="https://grid.test/guide"');
  expect(html).toContain('rel="noopener noreferrer"');
});
