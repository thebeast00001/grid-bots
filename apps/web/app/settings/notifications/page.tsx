"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { spring } from "@/lib/motion";
import type { PingFor, QuietHours } from "@/lib/notifications/rules";

type Settings = { quietHours: QuietHours; pingFor: PingFor };
type Device = "unsupported" | "blocked" | "off" | "tab" | "push";

const LEVELS: { id: PingFor; label: string; hint: string }[] = [
  { id: "all", label: "All results", hint: "Every routine result pings you." },
  { id: "skip-quiet", label: "Skip the quiet ones", hint: "Results a bot marks as nothing new wait in your inbox." },
  { id: "important", label: "Only what matters", hint: "Only results a bot marks important ping you." },
];

/** VAPID public keys come base64url; PushManager wants bytes. */
function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function NotificationSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [device, setDevice] = useState<Device>("off");

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((loaded) => {
        latest.current = loaded;
        setS(loaded);
      })
      .catch(() => {});
    (async () => {
      if (typeof Notification === "undefined") return setDevice("unsupported");
      if (Notification.permission === "denied") return setDevice("blocked");
      if (Notification.permission !== "granted") return setDevice("off");
      const reg = await navigator.serviceWorker?.getRegistration();
      setDevice((await reg?.pushManager.getSubscription()) ? "push" : "tab");
    })().catch(() => {});
  }, []);

  // The newest values, updated at once (not on the next render), so quick edits build on
  // each other; and a counter so a slow earlier save can't overwrite a newer one.
  const latest = useRef<Settings | null>(null);
  latest.current ??= s;
  const seq = useRef(0);
  const save = async (patch: Partial<Settings>) => {
    const next = { ...(latest.current as Settings), ...patch };
    latest.current = next;
    setS(next);
    const mine = ++seq.current;
    try {
      const saved = await api<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
      if (mine === seq.current) {
        latest.current = saved;
        setS(saved);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save that.");
    }
  };
  const quietNow = () => latest.current?.quietHours ?? { from: "22:00", to: "07:00" };

  const turnOn = async () => {
    const perm = await Notification.requestPermission();
    if (perm === "denied") return setDevice("blocked");
    if (perm !== "granted") return setDevice("off");
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return setDevice("tab");
    try {
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
      await api("/api/push", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setDevice("push");
    } catch {
      setDevice("tab");
    }
  };

  const turnOff = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setDevice("tab");
  };

  const quiet = s?.quietHours ?? null;
  const card = "rounded-2xl bg-[var(--surface)] p-4 edge";

  return (
    <main className="thin-scroll h-dvh overflow-y-auto">
      <div className="mx-auto max-w-[600px] px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="mb-4 flex h-12 items-center gap-2">
          <Link href="/" className="press hover-surface grid size-9 place-items-center rounded-full" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-[17px] font-semibold">Notifications</h1>
        </header>
        <nav className="mb-6 inline-flex rounded-full bg-[var(--surface-2)] p-1 text-[13px]">
          <Link href="/settings/models" className="press rounded-full px-3 py-1 text-[var(--text-2)]">
            Models
          </Link>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1 font-medium edge" aria-current="page">
            Notifications
          </span>
        </nav>

        <section className={`${card} mb-4`}>
          <h2 className="text-[15px] font-semibold">On this device</h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            {device === "push" && "Grid can reach you here even when no Grid tab is open."}
            {device === "tab" && "Grid shows notifications while a Grid tab is open. Install Grid as an app to get them when it's closed."}
            {device === "off" && "Allow notifications so reminders and routine results can reach you."}
            {device === "blocked" && "Notifications are blocked for Grid in this browser's site settings."}
            {device === "unsupported" && "This browser can't show notifications."}
          </p>
          {(device === "off" || (device === "tab" && "serviceWorker" in navigator)) && (
            <button onClick={turnOn} className="press mt-3 rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
              Turn on notifications
            </button>
          )}
          {device === "push" && (
            <button onClick={turnOff} className="press mt-3 rounded-full bg-[var(--surface-2)] px-3.5 py-1.5 text-[13px] font-medium">
              Stop notifications when Grid is closed
            </button>
          )}
        </section>

        <section className={`${card} mb-4`}>
          <h2 className="text-[15px] font-semibold">Ping me for</h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">Reminders always ping you. This is for routine results; the rest wait in your inbox.</p>
          <div role="radiogroup" aria-label="Ping me for" className="mt-3 flex flex-col gap-1">
            {LEVELS.map((l) => {
              const on = (s?.pingFor ?? "skip-quiet") === l.id;
              return (
                <button key={l.id} role="radio" aria-checked={on} onClick={() => save({ pingFor: l.id })} className="press hover-surface flex items-start gap-3 rounded-xl px-2 py-2 text-left">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full edge" style={{ background: on ? "var(--bot)" : "transparent" }}>
                    {on && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium">{l.label}</span>
                    <span className="block text-[12.5px] text-[var(--text-2)]">{l.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold">Quiet hours</h2>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">Only reminders ping you then. Everything else waits in your inbox.</p>
            </div>
            <button
              role="switch"
              aria-checked={quiet !== null}
              aria-label="Quiet hours"
              onClick={() => save({ quietHours: quiet ? null : { from: "22:00", to: "07:00" } })}
              className="press relative h-6 w-11 shrink-0 rounded-full"
              style={{ background: quiet ? "var(--bot)" : "var(--surface-3)" }}
            >
              <motion.span layout transition={spring.snappy} className="absolute top-0.5 size-5 rounded-full bg-white" style={{ left: quiet ? 22 : 2 }} />
            </button>
          </div>
          {quiet && (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <label className="flex items-center gap-2">
                <span className="text-[var(--text-2)]">From</span>
                <input aria-label="From" type="time" value={quiet.from} onChange={(e) => e.target.value && save({ quietHours: { ...quietNow(), from: e.target.value } })} className="field h-9 rounded-xl bg-[var(--surface-2)] px-2 outline-none" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[var(--text-2)]">To</span>
                <input aria-label="To" type="time" value={quiet.to} onChange={(e) => e.target.value && save({ quietHours: { ...quietNow(), to: e.target.value } })} className="field h-9 rounded-xl bg-[var(--surface-2)] px-2 outline-none" />
              </label>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
