"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Globe, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { ease } from "@/lib/motion";
import { stepsOf, summary, type Step } from "./sources";

/**
 * A reply's research, above its text: each search and page as it happens, then — once the
 * answer is in — one line ("Searched once · read 2 pages") that opens again on tap.
 */
export function ResearchStrip({ parts, answered }: { parts: UIMessage["parts"]; answered: boolean }) {
  const [open, setOpen] = useState(false);
  const steps = stepsOf(parts);
  if (!steps.length) return null;
  const working = steps.some((s) => s.state === "running");
  const foldable = answered && !working;
  const showSteps = !foldable || open;

  return (
    <div data-testid="research" className="mb-1.5 w-[min(440px,100%)] overflow-hidden rounded-2xl bg-[var(--surface)] text-[13px] edge">
      {foldable && (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="press flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--text-2)] hover:text-[var(--text)]"
        >
          <Globe size={14} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{summary(steps)}</span>
          <ChevronDown size={14} aria-hidden className="shrink-0 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      )}
      <AnimatePresence initial={false}>
        {showSteps && (
          <motion.ul
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: ease.out }}
            className={`flex flex-col gap-1.5 px-3 ${foldable ? "pb-2.5" : "py-2.5"}`}
          >
            {steps.map((s, i) => (
              <StepRow key={i} step={s} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const icon =
    step.state === "running" ? (
      <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
    ) : step.state === "failed" ? (
      <TriangleAlert size={14} className="text-[var(--danger)]" aria-hidden />
    ) : step.kind === "search" ? (
      <Search size={14} aria-hidden />
    ) : (
      <Globe size={14} aria-hidden />
    );

  let main: string;
  let rest = "";
  if (step.kind === "search") {
    const what = step.query ? `“${step.query}”` : "the web";
    if (step.state === "running") main = `Searching ${what}`;
    else if (step.state === "failed") [main, rest] = ["Search failed", step.error ? ` · ${step.error}` : ""];
    else [main, rest] = [`Searched ${what}`, step.count !== undefined ? ` · ${step.count} ${step.count === 1 ? "result" : "results"}` : ""];
  } else if (step.state === "running") main = `Reading ${step.site}`;
  else if (step.state === "failed") [main, rest] = [`Couldn't read ${step.site}`, step.error ? ` · ${step.error}` : ""];
  else [main, rest] = [`Read ${step.site}`, step.title && step.title !== step.site ? ` · ${step.title}` : ""];

  return (
    <li className="flex min-w-0 items-center gap-2 text-[var(--text-2)]">
      <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 truncate">
        <span className="text-[var(--text)]">{main}</span>
        {rest && <span className="text-[var(--text-3)]">{rest}</span>}
      </span>
    </li>
  );
}
