"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { SettingsNav } from "@/components/settings/settings-nav";
import { api } from "@/lib/api-client";

type Kind = "brave" | "tavily" | "searxng" | "test";
type State = { service: { kind: Kind; url?: string; hasKey: boolean } | null; builtIn: { label: string } | null };

const SERVICES: { id: Kind; label: string; hint: string; keyUrl?: string }[] = [
  { id: "brave", label: "Brave Search", hint: "Its own index of the web. Free monthly credit; needs a key.", keyUrl: "https://brave.com/search/api/" },
  { id: "tavily", label: "Tavily", hint: "Search made for AI. 1,000 free searches a month; needs a key.", keyUrl: "https://app.tavily.com/" },
  { id: "searxng", label: "SearXNG", hint: "Your own search server, on this computer or your network. No key." },
];

export default function WebSettings() {
  const [s, setS] = useState<State | null>(null);
  const [pick, setPick] = useState<Kind | "off">("off");
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (next: State) => {
    setS(next);
    setPick(next.service?.kind ?? "off");
    setUrl(next.service?.url ?? "");
    setKey("");
  };
  useEffect(() => {
    api<State>("/api/web").then(load).catch(() => {});
  }, []);

  const saved = s?.service ?? null;
  const services = saved?.kind === "test" ? [...SERVICES, { id: "test" as const, label: "Test search", hint: "Only in test mode." }] : SERVICES;
  const chosen = services.find((x) => x.id === pick);
  const keyKept = !!saved && saved.kind === pick && saved.hasKey;
  const needsKey = pick === "brave" || pick === "tavily";
  const dirty = pick !== (saved?.kind ?? "off") || key.trim() !== "" || (pick === "searxng" && url.trim() !== (saved?.url ?? ""));

  const save = async (service: { kind: Kind; key?: string; url?: string } | null) => {
    setBusy(true);
    setTest(null);
    try {
      load(await api<State>("/api/web", { method: "PATCH", body: JSON.stringify({ service }) }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: Kind | "off") => {
    setPick(id);
    setKey("");
    setTest(null);
    if (id === "off" && saved) void save(null);
  };

  const runTest = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; count?: number; error?: string }>("/api/web/test", { method: "POST" });
      setTest(r.ok ? { ok: true, text: `Works — ${r.count} ${r.count === 1 ? "result" : "results"}` } : { ok: false, text: r.error ?? "It didn't work." });
    } catch (e) {
      setTest({ ok: false, text: e instanceof Error ? e.message : "It didn't work." });
    } finally {
      setBusy(false);
    }
  };

  const status = !s
    ? ""
    : saved
      ? `Bots search the web with ${services.find((x) => x.id === saved.kind)?.label ?? saved.kind}, whatever model they use.`
      : s.builtIn
        ? `Your default model searches with ${s.builtIn.label}. Pick a service to search the same way with every model.`
        : "Bots can read links you send them but can't search yet. Pick a service to turn search on.";

  const card = "rounded-2xl bg-[var(--surface)] p-4 edge";
  const field = "field h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none";

  return (
    <main className="thin-scroll h-dvh overflow-y-auto">
      <div className="mx-auto max-w-[600px] px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="mb-4 flex h-12 items-center gap-2">
          <Link href="/" className="press hover-surface grid size-9 place-items-center rounded-full" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-[17px] font-semibold">Web</h1>
        </header>
        <SettingsNav current="Web" />

        <section aria-labelledby="search-heading" className={`${card} mb-4`}>
          <h2 id="search-heading" className="text-[15px] font-semibold">
            Searching the web
          </h2>
          <p className="mt-1 min-h-[1.4em] text-[13px] text-[var(--text-2)]">{status}</p>

          {/* Disabled until what is saved has loaded, so a quick first pick isn't undone by the load. */}
          <div role="radiogroup" aria-label="Search with" className="mt-3 flex flex-col gap-1">
            {[{ id: "off" as const, label: "Off", hint: "No search service." }, ...services].map((o) => {
              const on = pick === o.id;
              return (
                <button key={o.id} role="radio" aria-checked={on} onClick={() => choose(o.id)} disabled={busy || !s} className="press hover-surface flex items-start gap-3 rounded-xl px-2 py-2 text-left">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full edge" style={{ background: on ? "var(--bot)" : "transparent" }}>
                    {on && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium">{o.label}</span>
                    <span className="block text-[12.5px] text-[var(--text-2)]">{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {pick !== "off" && chosen && (
            <form
              className="mt-3 flex flex-col gap-2 border-t border-[var(--edge)] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save({ kind: pick, ...(needsKey && key.trim() ? { key: key.trim() } : {}), ...(pick === "searxng" ? { url: url.trim() } : {}) });
              }}
            >
              {needsKey && (
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-[13px] text-[var(--text-2)]">
                    <span>{chosen.label} key</span>
                    {chosen.keyUrl && (
                      <a href={chosen.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-[var(--text)]">
                        Get a key <ArrowUpRight size={13} />
                      </a>
                    )}
                  </span>
                  <input
                    aria-label={`${chosen.label} key`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={keyKept ? "Key saved · paste a new one to replace it" : "Paste your key"}
                    className={field}
                  />
                </label>
              )}
              {pick === "searxng" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[var(--text-2)]">SearXNG address (with the json format turned on)</span>
                  <input aria-label="SearXNG address" inputMode="url" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:8888" className={field} />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {(dirty || pick === "test") && (
                  <button type="submit" disabled={busy || (needsKey && !key.trim() && !keyKept)} className="press rounded-full px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
                    Save
                  </button>
                )}
                {saved && saved.kind === pick && !dirty && (
                  <>
                    {needsKey && <span className="inline-flex items-center gap-1 text-[13px] text-[var(--text-2)]"><Check size={14} /> Key saved</span>}
                    <button type="button" onClick={runTest} disabled={busy} className="press rounded-full bg-[var(--surface-2)] px-3.5 py-1.5 text-[13px] font-medium">
                      Test
                    </button>
                  </>
                )}
                {test && (
                  <span role="status" className="inline-flex min-w-0 items-center gap-1 text-[13px]" style={{ color: test.ok ? "var(--text)" : "var(--danger)" }}>
                    {test.ok ? <Check size={14} className="shrink-0" /> : <TriangleAlert size={14} className="shrink-0" />}
                    <span className="min-w-0">{test.text}</span>
                  </span>
                )}
              </div>
            </form>
          )}
        </section>

        <section aria-labelledby="reading-heading" className={card}>
          <h2 id="reading-heading" className="text-[15px] font-semibold">
            Reading pages
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
            Bots read pages straight from this computer, only public websites (never your own network), and only links you sent or that came from a search. Searches go to the service you pick. What a page says is treated as information, never as instructions.
          </p>
        </section>
      </div>
    </main>
  );
}
