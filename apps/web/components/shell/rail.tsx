"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Home, Moon, Sun } from "lucide-react";
import { InboxButton } from "@/components/notifications/inbox";

function GridMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle
            key={`${r}${c}`}
            cx={5 + c * 8}
            cy={5 + r * 8}
            r={r === 1 && c === 1 ? 3.6 : 2.2}
            fill={r === 1 && c === 1 ? "oklch(0.6 0.2 295)" : "var(--text-3)"}
          />
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

export function Rail() {
  const pathname = usePathname();
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

  const items = [
    { href: "/", icon: Home, label: "Home", active: pathname === "/" || pathname.startsWith("/bots") || pathname === "/new" },
    { href: "/settings/models", icon: Cpu, label: "Models", active: pathname.startsWith("/settings") },
  ];

  return (
    <nav className="edge-r flex w-[60px] shrink-0 flex-col items-center gap-1 bg-[var(--panel)] py-3">
      <div className="mb-3 grid size-9 place-items-center" title="Grid">
        <GridMark />
      </div>
      {items.map(({ href, icon: Icon, label, active }) => (
        <Link
          key={label}
          href={href}
          title={label}
          aria-label={label}
          className={`press grid size-10 place-items-center rounded-xl ${active ? "bg-[var(--surface-3)] text-[var(--text)]" : "hover-surface text-[var(--text-3)]"}`}
        >
          <Icon size={19} />
        </Link>
      ))}
      <InboxButton />
      <div className="flex-1" />
      <button onClick={toggle} title="Theme" aria-label="Toggle theme" className="press hover-surface grid size-10 place-items-center rounded-xl text-[var(--text-3)]">
        <Sun size={18} className="when-dark" />
        <Moon size={18} className="when-light" />
      </button>
    </nav>
  );
}
