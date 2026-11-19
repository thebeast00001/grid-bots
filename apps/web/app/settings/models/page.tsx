"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConnectModel } from "@/components/models/connect-model";
import { ModelPicker } from "@/components/models/model-picker";
import { api } from "@/lib/api-client";
import type { ModelRef, ProviderView } from "@/lib/client-types";
import { ease } from "@/lib/motion";

type Settings = { defaultModel: ModelRef | null; chatgptWelcomeSeen: boolean };

function ModelsSettings() {
  const params = useSearchParams();
  const [providers, setProviders] = useState<ProviderView[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([api<{ providers: ProviderView[] }>("/api/providers"), api<Settings>("/api/settings")]);
    setProviders(p.providers);
    setSettings(s);
    setPickerKey((k) => k + 1);
  }, []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const save = async (patch: Partial<Settings>) => setSettings(await api<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }));
  const remove = async (id: string) => {
    await api(`/api/providers/${id}`, { method: "DELETE" });
    await load();
  };

  const status = params.get("chatgpt");
  const showWelcome = status === "connected" && settings !== null && !settings.chatgptWelcomeSeen;

  return (
    <main className="thin-scroll h-dvh overflow-y-auto">
      <div className="mx-auto max-w-[600px] px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="mb-6 flex h-12 items-center gap-2">
          <Link href="/" className="press hover-surface grid size-9 place-items-center rounded-full" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-[17px] font-semibold">Models</h1>
        </header>
        <nav className="-mt-2 mb-6 inline-flex rounded-full bg-[var(--surface-2)] p-1 text-[13px]">
          <span className="rounded-full bg-[var(--surface)] px-3 py-1 font-medium edge" aria-current="page">
            Models
          </span>
          <Link href="/settings/notifications" className="press rounded-full px-3 py-1 text-[var(--text-2)]">
            Notifications
          </Link>
        </nav>

        {status === "error" && (
          <div role="alert" className="mb-4 rounded-2xl px-4 py-3 text-[13.5px]" style={{ background: "color-mix(in oklch, oklch(0.63 0.2 25) 14%, var(--surface))" }}>
            ChatGPT sign-in didn&apos;t finish ({params.get("reason") ?? "unknown"}). Try again.
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-2 text-[13px] font-medium text-[var(--text-2)]">Connected</h2>
          {providers?.length === 0 && <p className="text-[14px] text-[var(--text-3)]">Nothing yet.</p>}
          <div className="flex flex-col">
            {providers?.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{p.label}</div>
                  <div className="text-[12.5px] text-[var(--text-3)]">{p.hint ? (p.hint.includes("@") ? p.hint : `Key ending ${p.hint}`) : (p.baseUrl ?? "")}</div>
                </div>
                <button onClick={() => remove(p.id)} className="press hover-surface grid size-9 place-items-center rounded-full text-[var(--text-2)]" aria-label={`Remove ${p.label}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {settings && providers && providers.length > 0 && (
            <div className="mt-3">
              <ModelPicker key={pickerKey} label="Default model" value={settings.defaultModel} onChange={(defaultModel) => save({ defaultModel })} />
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-medium text-[var(--text-2)]">Add a model</h2>
          <ConnectModel compact onConnected={() => load()} />
        </section>
      </div>

      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-50 grid place-items-center p-6">
            <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="chatgpt-welcome-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="relative w-full max-w-[380px] rounded-[24px] bg-[var(--surface)] p-6 text-center edge"
            >
              <h2 id="chatgpt-welcome-title" className="text-[18px] font-semibold">
                You&apos;re using your ChatGPT plan
              </h2>
              <p className="mt-2 text-[14px] text-[var(--text-2)]">
                Grid uses your plan&apos;s limits. You can set a cap for Grid in your ChatGPT usage settings.
              </p>
              <button onClick={() => save({ chatgptWelcomeSeen: true })} className="press mt-5 h-10 w-full rounded-full bg-[var(--text)] text-[14px] font-semibold text-[var(--bg)]">
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ModelsSettings />
    </Suspense>
  );
}
