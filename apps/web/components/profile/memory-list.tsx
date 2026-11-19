"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pin, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { BotView } from "@/lib/client-types";
import { spring } from "@/lib/motion";

type Memory = { id: string; botId: string | null; text: string; source: "you" | "bot"; pinned: boolean; createdAt: string };
type Scope = "you" | "bot";

/** What the bot knows: shared "About you" memories and its own notes. Every row can be edited, pinned or deleted. */
export function MemoryList({ bot, version }: { bot: BotView; version: number }) {
  const [scope, setScope] = useState<Scope>("you");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Memory[] | null>(null);
  const [draft, setDraft] = useState("");

  const query = useCallback(() => {
    const p = new URLSearchParams({ scope });
    if (scope === "bot") p.set("botId", bot.id);
    if (q.trim()) p.set("q", q.trim());
    return `/api/memories?${p}`;
  }, [scope, bot.id, q]);

  const load = useCallback(async () => {
    setItems((await api<{ memories: Memory[] }>(query())).memories);
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => void load().catch(() => setItems([])), q ? 150 : 0);
    return () => clearTimeout(t);
  }, [load, q, version]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await api("/api/memories", { method: "POST", body: JSON.stringify({ botId: scope === "you" ? null : bot.id, text }) }).catch(() => toast("Couldn't save that."));
    await load();
  };

  const patch = async (m: Memory, body: Partial<Pick<Memory, "text" | "pinned">>) => {
    setItems((list) => list?.map((x) => (x.id === m.id ? { ...x, ...body } : x)) ?? null);
    await api(`/api/memories/${m.id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(() => toast("Couldn't save that."));
    await load();
  };

  const remove = async (m: Memory) => {
    setItems((list) => list?.filter((x) => x.id !== m.id) ?? null);
    await api(`/api/memories/${m.id}`, { method: "DELETE" }).catch(() => {});
    toast("Memory deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => {
          await api("/api/memories", { method: "POST", body: JSON.stringify({ botId: m.botId, text: m.text, pinned: m.pinned }) }).catch(() => {});
          await load();
        },
      },
    });
  };

  const tabs: { id: Scope; label: string }[] = [
    { id: "you", label: "About you" },
    { id: "bot", label: `${bot.name}'s notes` },
  ];

  return (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-[var(--text-2)]">Memory</h2>
      <div role="tablist" aria-label="Memory" className="mb-2 inline-flex rounded-full bg-[var(--surface-2)] p-1">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={scope === t.id} onClick={() => setScope(t.id)} className="press relative rounded-full px-3 py-1 text-[12.5px] font-medium">
            {scope === t.id && <motion.span layoutId={`mem-tab-${bot.id}`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-[var(--surface)] edge" />}
            <span className={`relative ${scope === t.id ? "text-[var(--text)]" : "text-[var(--text-2)]"}`}>{t.label}</span>
          </button>
        ))}
      </div>

      <label className="mb-2 flex h-9 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 text-[var(--text-3)]">
        <Search size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories" aria-label="Search memories" className="w-full bg-transparent text-[13.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]" />
      </label>

      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {items?.map((m) => (
            <motion.li
              key={m.id}
              layout="position"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={spring.smooth}
              data-testid="memory"
              className="group flex items-start gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 edge"
            >
              <div className="min-w-0 flex-1">
                <EditableText value={m.text} onSave={(text) => patch(m, { text })} />
                <div className="mt-0.5 text-[11.5px] text-[var(--text-3)]">{m.source === "you" ? "You told me" : "I noticed"}</div>
              </div>
              <button
                aria-label={m.pinned ? "Unpin memory" : "Pin memory"}
                aria-pressed={m.pinned}
                onClick={() => patch(m, { pinned: !m.pinned })}
                className="press grid size-7 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)]"
                style={{ color: m.pinned ? "var(--bot-strong)" : "var(--text-3)" }}
              >
                <Pin size={13} fill={m.pinned ? "currentColor" : "none"} />
              </button>
              <button aria-label="Delete memory" onClick={() => remove(m)} className="press grid size-7 shrink-0 place-items-center rounded-full text-[var(--text-3)] hover:bg-[var(--surface-2)]">
                <Trash2 size={13} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items?.length === 0 && <p className="py-2 text-[13px] text-[var(--text-3)]">{q ? "Nothing matches." : scope === "you" ? `Nothing yet. Tell ${bot.name} about yourself.` : "No notes yet."}</p>}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void add()}
        placeholder={scope === "you" ? "Add something about you" : "Add a note"}
        aria-label={scope === "you" ? "Add something about you" : "Add a note"}
        maxLength={1000}
        className="mt-2 h-9 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[13.5px] outline-none placeholder:text-[var(--text-3)]"
      />
    </section>
  );
}

function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="block w-full break-words text-left text-[13.5px]" title="Edit">
        {value}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== value) onSave(text.trim());
    else setText(value);
  };
  return (
    <input
      autoFocus
      aria-label="Edit memory"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setText(value);
          setEditing(false);
        }
      }}
      className="w-full rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[13.5px] outline-none"
    />
  );
}
