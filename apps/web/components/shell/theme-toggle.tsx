"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function GridMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle key={`${r}${c}`} cx={5 + c * 8} cy={5 + r * 8} r={r === 1 && c === 1 ? 3.6 : 2.2} fill={r === 1 && c === 1 ? "oklch(0.6 0.2 295)" : "var(--text-3)"} />
        )),
      )}
    </svg>
  );
}

function readTheme(): "light" | "dark" | null {
  try {
    const t = localStorage.getItem("grid-theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** Light/dark switch; also applies the saved choice when the app opens. */
export function ThemeToggle() {
  useEffect(() => {
    const t = readTheme();
    if (t) document.documentElement.dataset.theme = t;
  }, []);
  // Read at click time: the icon itself is chosen by CSS, so server and browser render the same markup.
  const toggle = () => {
    const set = document.documentElement.dataset.theme;
    const dark = set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("grid-theme", next);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
  };
  return (
    <button onClick={toggle} title="Theme" aria-label="Toggle theme" className="press hover-surface grid size-8 place-items-center rounded-lg text-[var(--text-3)]">
      <Sun size={16} className="when-dark" />
      <Moon size={16} className="when-light" />
    </button>
  );
}
