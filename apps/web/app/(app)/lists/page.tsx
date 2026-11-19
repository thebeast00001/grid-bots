"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL, KindIcon, summaryOf } from "@/components/lists/list-parts";
import { createList, useLists } from "@/components/lists/lists-store";
import type { ListKind } from "@/lib/client-types";
import { ease } from "@/lib/motion";

const KINDS: { id: ListKind; hint: string }[] = [
  { id: "checklist", hint: "Groceries, packing, to-dos" },
  { id: "habits", hint: "Daily, with streaks" },
  { id: "expenses", hint: "Amounts that add up" },
];

export default function ListsPage() {
  const lists = useLists();
  const router = useRouter();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ListKind>("checklist");
  const [busy, setBusy] = useState(false);
  const locale = typeof navigator === "undefined" ? undefined : navigator.language;

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const v = await createList(name.trim(), kind);
      router.push(`/lists/${v.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't make that list.");
      setBusy(false);
    }
  };

  return (
    <div className="thin-scroll h-dvh w-full overflow-y-auto">
      <div className="mx-auto max-w-[680px] px-4 pb-16 pt-[max(16px,env(safe-area-inset-top))]">
        <header className="mb-5 flex h-12 items-center gap-2">
          <Link href="/bots" aria-label="Back" className="press hover-surface grid size-9 place-items-center rounded-full md:hidden">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="flex-1 text-[22px] font-semibold tracking-[-0.01em]">Lists</h1>
          <button onClick={() => setMaking((m) => !m)} aria-expanded={making} className="press inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
            <Plus size={15} /> New list
          </button>
        </header>

        <AnimatePresence initial={false}>
          {making && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <div className="mb-5 rounded-2xl bg-[var(--surface)] p-3 edge">
                <input aria-label="List name" autoFocus placeholder="Name it: Groceries, Goa trip, Habits…" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="field h-11 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[15px] outline-none" />
                <div role="radiogroup" aria-label="Kind" className="mt-2 grid grid-cols-3 gap-1.5">
                  {KINDS.map((k) => (
                    <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className="press rounded-xl px-2.5 py-2 text-left edge" style={{ background: kind === k.id ? "var(--bot-soft)" : "transparent" }}>
                      <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                        <KindIcon kind={k.id} size={14} /> {KIND_LABEL[k.id]}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-tight text-[var(--text-2)]">{k.hint}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 flex justify-end">
                  <button type="submit" disabled={!name.trim() || busy} className="press rounded-full px-4 py-1.5 text-[13px] font-semibold disabled:opacity-50" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
                    Create
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {lists === null ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[84px] rounded-2xl bg-[var(--surface)] edge" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] px-5 py-8 text-center edge">
            <p className="text-[15px] font-medium">No lists yet</p>
            <p className="mx-auto mt-1 max-w-[340px] text-[13.5px] text-[var(--text-2)]">
              Ask any bot: &ldquo;make me a packing list for Goa: sunscreen, charger&rdquo;, &ldquo;track my habits: run, read&rdquo; or &ldquo;I spent 250 on lunch&rdquo;. Or make one here.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lists.map((l) => {
              const all = l.open + l.done;
              const share = l.kind === "expenses" || !all ? 0 : l.done / all;
              return (
                <li key={l.id}>
                  <Link href={`/lists/${l.id}`} data-testid="list-tile" className="press block h-full rounded-2xl bg-[var(--surface)] p-3.5 edge hover:bg-[var(--surface-2)]">
                    <div className="flex items-center gap-2 text-[var(--text-2)]">
                      <KindIcon kind={l.kind} size={14} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--text)]">{l.name}</span>
                    </div>
                    <div className="tnum mt-1 text-[13px] text-[var(--text-2)]">{summaryOf(l, locale)}</div>
                    {l.kind !== "expenses" && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${share * 100}%`, background: "var(--bot)" }} />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
