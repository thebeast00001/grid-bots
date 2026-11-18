"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, KeyRound, Laptop, Loader2, Sparkles } from "lucide-react";
import { ApiError, api } from "@/lib/api-client";
import type { ApiErrorBody, KindView, ProviderView } from "@/lib/client-types";
import { ease, spring } from "@/lib/motion";

type Props = { onConnected: (p: ProviderView) => void; compact?: boolean };

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return (e.body as ApiErrorBody)?.error?.message ?? e.message;
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** The three ways in: ChatGPT plan, a local model, or an API key. */
export function ConnectModel({ onConnected, compact = false }: Props) {
  const [kinds, setKinds] = useState<KindView[]>([]);
  const [local, setLocal] = useState<{ ollama: boolean; lmstudio: boolean } | null>(null);
  const [open, setOpen] = useState<"key" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingChatgpt, setWaitingChatgpt] = useState(false);
  const firstOpen = useRef(true);

  useEffect(() => {
    api<{ kinds: KindView[] }>("/api/providers").then((r) => setKinds(r.kinds)).catch(() => {});
    api<{ ollama: boolean; lmstudio: boolean }>("/api/providers/detect").then(setLocal).catch(() => setLocal({ ollama: false, lmstudio: false }));
    firstOpen.current = false;
  }, []);

  // While the ChatGPT tab is open, watch for the new connection.
  useEffect(() => {
    if (!waitingChatgpt) return;
    const t = window.setInterval(async () => {
      const r = await api<{ providers: ProviderView[] }>("/api/providers").catch(() => null);
      const p = r?.providers.find((x) => x.kind === "chatgpt");
      if (p) {
        setWaitingChatgpt(false);
        onConnected(p);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [waitingChatgpt, onConnected]);

  const connect = async (label: string, body: Record<string, string>) => {
    setBusy(label);
    setError(null);
    try {
      onConnected(await api<ProviderView>("/api/providers", { method: "POST", body: JSON.stringify(body) }));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const chatgpt = async () => {
    setBusy("chatgpt");
    setError(null);
    try {
      const { authorizeUrl } = await api<{ authorizeUrl: string }>("/api/providers/chatgpt/start", { method: "POST" });
      window.open(authorizeUrl, "_blank", "noopener");
      setWaitingChatgpt(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const enter = (i: number) =>
    firstOpen.current ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: ease.out, delay: i * 0.04 } } : {};

  return (
    <div className="flex flex-col gap-3">
      <motion.div {...enter(0)}>
        <Choice
          icon={<Sparkles size={18} />}
          title="Continue with ChatGPT"
          sub={waitingChatgpt ? "Finish signing in in the new tab…" : "Use your Go, Plus, Pro or Business plan. Nothing extra to pay."}
          onClick={chatgpt}
          busy={busy === "chatgpt" || waitingChatgpt}
          compact={compact}
        />
      </motion.div>

      <motion.div {...enter(1)}>
        <div className="rounded-[22px] bg-[var(--surface)] p-4 edge">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]">
              <Laptop size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Use a local model</div>
              <div className="text-[13px] text-[var(--text-2)]">Runs on this computer. Private and free.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["ollama", "lmstudio"] as const).map((k) => {
                  const ready = local?.[k];
                  return (
                    <button
                      key={k}
                      disabled={!ready || busy !== null}
                      onClick={() => connect(k, { kind: k })}
                      className="press inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium disabled:opacity-50"
                      style={{ background: ready ? "var(--text)" : "var(--surface-2)", color: ready ? "var(--bg)" : "var(--text-2)" }}
                    >
                      {busy === k && <Loader2 size={14} className="animate-spin" />}
                      {k === "ollama" ? "Ollama" : "LM Studio"}
                      <span className="text-[11px] opacity-70">{local === null ? "checking…" : ready ? "ready" : "not running"}</span>
                    </button>
                  );
                })}
                {local && !local.ollama && !local.lmstudio && (
                  <button
                    onClick={() => api<typeof local>("/api/providers/detect").then(setLocal)}
                    className="press hover-surface rounded-full px-3 text-[13px] text-[var(--text-2)]"
                  >
                    Check again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div {...enter(2)}>
        <AnimatePresence initial={false} mode="popLayout">
          {open !== "key" ? (
            <motion.div key="closed" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              <Choice icon={<KeyRound size={18} />} title="Paste an API key" sub="OpenAI, Claude, Gemini, Grok, Groq, Mistral, DeepSeek, OpenRouter, or your own server." onClick={() => setOpen("key")} compact={compact} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
              <KeyForm kinds={kinds} busy={busy === "key"} onSubmit={(body) => connect("key", body)} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: ease.out }}
            className="rounded-2xl px-4 py-3 text-[13.5px]"
            style={{ background: "color-mix(in oklch, oklch(0.63 0.2 25) 14%, var(--surface))", color: "var(--text)" }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Choice({ icon, title, sub, onClick, busy, compact }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; busy?: boolean; compact?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={`press hover-surface flex w-full items-center gap-3 rounded-[22px] bg-[var(--surface)] text-left edge ${compact ? "p-3" : "p-4"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)]">{busy ? <Loader2 size={18} className="animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-[var(--text-2)]">{sub}</span>
      </span>
    </button>
  );
}

function KeyForm({ kinds, busy, onSubmit }: { kinds: KindView[]; busy: boolean; onSubmit: (b: Record<string, string>) => void }) {
  const options = kinds.filter((k) => k.auth === "key" || k.auth === "optional-key" || k.kind === "mock");
  const [kind, setKind] = useState(options[0]?.kind ?? "openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const info = kinds.find((k) => k.kind === kind);
  const needsKey = info?.auth === "key" || info?.auth === "optional-key";

  return (
    <form
      className="rounded-[22px] bg-[var(--surface)] p-4 edge"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ kind, ...(apiKey ? { apiKey } : {}), ...(baseUrl ? { baseUrl } : {}) });
      }}
    >
      <div className="mb-3 text-[15px] font-semibold">Paste an API key</div>
      <label className="mb-2 block">
        <span className="mb-1 block text-[12.5px] text-[var(--text-2)]">Provider</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none">
          {options.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {info?.note && <p className="mb-2 text-[12.5px] text-[var(--text-2)]">{info.note}</p>}
      {kind === "custom" && (
        <label className="mb-2 block">
          <span className="mb-1 block text-[12.5px] text-[var(--text-2)]">Server address</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8000/v1" className="h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none" />
        </label>
      )}
      {needsKey && (
        <label className="mb-2 block">
          <span className="mb-1 flex items-center justify-between text-[12.5px] text-[var(--text-2)]">
            API key
            {info?.keyUrl && (
              <a href={info.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                Get a key <ExternalLink size={11} />
              </a>
            )}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={kind === "custom" ? "Optional" : "Paste it here"}
            className="h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[14px] outline-none"
          />
        </label>
      )}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={busy} className="press inline-flex h-10 items-center gap-2 rounded-full bg-[var(--text)] px-5 text-[14px] font-semibold text-[var(--bg)] disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />}
          Connect
        </button>
      </div>
    </form>
  );
}
