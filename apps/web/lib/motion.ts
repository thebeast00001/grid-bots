import type { Transition } from "motion/react";

/** Motion tokens from docs/UI.md §3.2. */
export const spring = {
  snappy: { type: "spring", duration: 0.25, bounce: 0 } satisfies Transition,
  smooth: { type: "spring", duration: 0.4, bounce: 0.1 } satisfies Transition,
  lively: { type: "spring", duration: 0.5, bounce: 0.3 } satisfies Transition,
};

export const ease = {
  out: [0.23, 1, 0.32, 1] as [number, number, number, number],
  inOut: [0.77, 0, 0.175, 1] as [number, number, number, number],
  drawer: [0.32, 0.72, 0, 1] as [number, number, number, number],
};
