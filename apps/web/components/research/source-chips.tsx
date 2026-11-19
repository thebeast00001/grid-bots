"use client";

import { useState } from "react";
import { defaultComponents, type Components } from "streamdown";
import type { Source } from "./sources";

const FIRST = 6;

/** Under a reply: the pages it used, each opening in a new tab. */
export function SourceChips({ sources }: { sources: Source[] }) {
  const [all, setAll] = useState(false);
  if (!sources.length) return null;
  const shown = all ? sources : sources.slice(0, FIRST);
  return (
    <div role="list" aria-label="Sources" className="mt-1.5 flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <a
          key={s.n}
          role="listitem"
          data-testid="source-chip"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${s.title}\n${s.url}`}
          className="press flex max-w-[min(280px,100%)] items-center gap-1.5 rounded-full bg-[var(--surface)] py-1 pl-1 pr-2.5 text-[12.5px] edge hover:bg-[var(--surface-2)]"
        >
          <span className="tnum grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[11px] font-semibold" style={{ background: "var(--bot-soft)" }}>
            {s.n}
          </span>
          <span className="shrink-0 font-medium">{s.site}</span>
          {s.title !== s.site && <span className="min-w-0 truncate text-[var(--text-2)]">{s.title}</span>}
        </a>
      ))}
      {sources.length > FIRST && !all && (
        <button onClick={() => setAll(true)} className="press rounded-full px-2.5 py-1 text-[12.5px] text-[var(--text-2)] edge hover:bg-[var(--surface-2)]">
          +{sources.length - FIRST} more
        </button>
      )}
    </div>
  );
}

/** Markdown components for a reply: "[1](#cite-1)" links (see citeLinks) become small numbered links to the source. */
export function citeComponents(sources: Source[]): Components {
  const byN = new Map(sources.map((s) => [s.n, s]));
  const Link = defaultComponents.a;
  return {
    a: (props) => {
      // The markdown sanitiser prefixes in-page ids, so "#cite-1" arrives as "#user-content-cite-1".
      const m = /^#(?:user-content-)?cite-(\d+)$/.exec(String(props.href ?? ""));
      const s = m ? byN.get(Number(m[1])) : undefined;
      if (!s) return Link ? <Link {...props} /> : <a {...props} />;
      return (
        <a
          data-testid="cite"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${s.site} · ${s.title}`}
          aria-label={`Source ${s.n}: ${s.site}`}
          className="tnum mx-[1px] inline-grid h-[18px] min-w-[18px] -translate-y-[1px] place-items-center rounded-full px-1 align-middle text-[11px] font-semibold leading-none no-underline"
          style={{ background: "var(--bot-soft)", color: "var(--text)" }}
        >
          {s.n}
        </a>
      );
    },
  };
}
