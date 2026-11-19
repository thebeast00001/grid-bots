"use client";

import { MotionConfig } from "motion/react";

/** Honours the system "reduce motion" setting everywhere: movement stops, fades and colour changes stay (UI.md §3 rule 8). */
export function MotionPrefs({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
