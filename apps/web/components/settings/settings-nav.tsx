import Link from "next/link";

const TABS = [
  { href: "/settings/models", label: "Models" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/web", label: "Web" },
] as const;

/** The tabs across the settings pages. */
export function SettingsNav({ current, className = "mb-6" }: { current: (typeof TABS)[number]["label"]; className?: string }) {
  return (
    <nav aria-label="Settings" className={`${className} inline-flex rounded-full bg-[var(--surface-2)] p-1 text-[13px]`}>
      {TABS.map((t) =>
        t.label === current ? (
          <span key={t.href} className="rounded-full bg-[var(--surface)] px-3 py-1 font-medium edge" aria-current="page">
            {t.label}
          </span>
        ) : (
          <Link key={t.href} href={t.href} className="press rounded-full px-3 py-1 text-[var(--text-2)]">
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}
