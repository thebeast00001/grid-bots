"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { ChevronDown, GripVertical, Pencil, Share2, Trash2, X } from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { useBots } from "@/components/shell/bots-store";
import type { ItemView, ListView } from "@/lib/client-types";
import { formatAmount, parseAmount, shareText } from "@/lib/lists/format";
import { ease } from "@/lib/motion";
import { KIND_LABEL, KindIcon, Tick, dayLabel, streakText, today } from "./list-parts";
import { addItem, checkInDay, deleteList, editItem, removeItem, renameList, reorderItems, setDone } from "./lists-store";

/** A whole list: its header (rename, share, delete) and the body for its kind. */
export function ListView({ list }: { list: ListView }) {
  return (
    <div>
      <ListHeader list={list} />
      {list.kind === "checklist" && <ChecklistBody list={list} />}
      {list.kind === "habits" && <HabitsBody list={list} />}
      {list.kind === "expenses" && <ExpensesBody list={list} />}
    </div>
  );
}

const pill = "press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium";

function ListHeader({ list }: { list: ListView }) {
  const router = useRouter();
  const { bots } = useBots();
  const maker = list.botId ? bots?.find((b) => b.id === list.botId) : undefined;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [confirm, setConfirm] = useState(false);

  const saveName = async () => {
    setRenaming(false);
    const clean = name.trim();
    if (!clean || clean === list.name) return setName(list.name);
    try {
      await renameList(list.id, clean);
    } catch (e) {
      setName(list.name);
      toast(e instanceof Error ? e.message : "Couldn't rename it.");
    }
  };

  const share = async () => {
    const text = shareText(list, navigator.language);
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ title: list.name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied. Paste it anywhere.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast("Couldn't share it.");
    }
  };

  const remove = async () => {
    try {
      await deleteList(list.id);
      router.push("/lists");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete it.");
    }
  };

  return (
    <header className="mb-5">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
        <KindIcon kind={list.kind} size={13} />
        <span>{KIND_LABEL[list.kind]}</span>
        {maker && <span className="truncate">· made by {maker.name}</span>}
      </div>
      {renaming ? (
        <input
          aria-label="List name"
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setName(list.name);
              setRenaming(false);
            }
          }}
          className="field mt-1 h-10 w-full rounded-xl bg-[var(--surface-2)] px-3 text-[22px] font-semibold outline-none"
        />
      ) : (
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <h1 className="min-w-0 truncate text-[24px] font-semibold tracking-[-0.01em]">{list.name}</h1>
          <button aria-label={`Rename ${list.name}`} title="Rename" onClick={() => (setName(list.name), setRenaming(true))} className="press hover-surface grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-3)]">
            <Pencil size={14} />
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button onClick={share} className={`${pill} bg-[var(--surface)] edge`}>
          <Share2 size={14} /> Share
        </button>
        {!confirm && (
          <button onClick={() => setConfirm(true)} aria-label="Delete list" className={`${pill} text-[var(--text-2)] hover:bg-[var(--surface)]`}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: ease.out }}
            role="alertdialog"
            aria-label={`Delete ${list.name}?`}
            className="mt-3 rounded-2xl bg-[var(--surface)] p-3 edge"
          >
            <p className="text-[13.5px]">
              Delete <span className="font-semibold">{list.name}</span> and everything on it? This can&apos;t be undone.
            </p>
            <div className="mt-2.5 flex gap-1.5">
              <button onClick={remove} className={pill} style={{ background: "var(--danger)", color: "white" }}>
                Delete for good
              </button>
              <button autoFocus onClick={() => setConfirm(false)} className={`${pill} hover:bg-[var(--surface-2)]`}>
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** One line to add with: Enter adds and keeps the cursor there. */
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t);
      setText("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add that.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && void submit()}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={200}
      className="field mb-3 h-11 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] outline-none edge"
    />
  );
}

/** Click the text to change it. */
function ItemText({ list, item, done }: { list: ListView; item: ItemView; done?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  if (editing) {
    const save = () => {
      setEditing(false);
      const t = text.trim();
      if (t && t !== item.text) void editItem(list.id, item.id, { text: t }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't change it."));
      else setText(item.text);
    };
    return (
      <input
        autoFocus
        aria-label={`Edit ${item.text}`}
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") (setText(item.text), setEditing(false));
        }}
        className="field h-8 min-w-0 flex-1 rounded-lg bg-[var(--surface-2)] px-2 text-[15px] outline-none"
      />
    );
  }
  return (
    <span
      data-testid="item-text"
      onClick={() => (setText(item.text), setEditing(true))}
      className={`min-w-0 flex-1 cursor-text break-words py-1 text-[15px] ${done ? "text-[var(--text-3)] line-through decoration-[var(--text-3)]" : ""}`}
    >
      {item.text}
    </span>
  );
}

function RemoveButton({ list, item }: { list: ListView; item: ItemView }) {
  return (
    <button
      aria-label={`Remove ${item.text}`}
      title="Remove"
      onClick={() => void removeItem(list.id, item.id).catch(() => toast("Couldn't remove it."))}
      className="press grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-3)] opacity-100 hover:bg-[var(--surface-2)] hover:text-[var(--text)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
    >
      <X size={15} />
    </button>
  );
}

/**
 * Items you can drag by the handle (mouse or touch) or move with the arrow keys while the
 * handle has focus. The new order is saved when the drag ends, or at once from the keyboard.
 */
function Sortable({ list, items, testId, row }: { list: ListView; items: ItemView[]; testId: string; row: (item: ItemView, handle: React.ReactNode) => React.ReactNode }) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const dragging = useRef(false);
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const key = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!dragging.current) setOrder(key ? key.split(",") : []);
  }, [key]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order.filter((id) => byId.has(id));
  const save = (ids: string[]) => void reorderItems(list.id, ids).catch(() => toast("Couldn't save the new order."));

  const move = (id: string, by: number) => {
    const from = shown.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= shown.length) return;
    const next = [...shown];
    next.splice(to, 0, ...next.splice(from, 1));
    setOrder(next);
    save(next);
    requestAnimationFrame(() => handles.current.get(id)?.focus());
  };

  return (
    <Reorder.Group as="ul" axis="y" values={shown} onReorder={setOrder} data-testid={testId} className="flex flex-col">
      {shown.map((id) => (
        <SortableItem
          key={id}
          id={id}
          label={byId.get(id)!.text}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={() => {
            dragging.current = false;
            save(shown);
          }}
          onMove={(by) => move(id, by)}
          handleRef={(el) => (el ? handles.current.set(id, el) : handles.current.delete(id))}
        >
          {(handle) => row(byId.get(id)!, handle)}
        </SortableItem>
      ))}
    </Reorder.Group>
  );
}

function SortableItem(p: {
  id: string;
  label: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (by: number) => void;
  handleRef: (el: HTMLButtonElement | null) => void;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const controls = useDragControls();
  const handle = (
    <button
      ref={p.handleRef}
      aria-label={`Move ${p.label}`}
      title="Drag, or use the arrow keys"
      onPointerDown={(e) => controls.start(e)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          p.onMove(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-full text-[var(--text-3)] hover:text-[var(--text-2)] active:cursor-grabbing"
    >
      <GripVertical size={15} />
    </button>
  );
  return (
    <Reorder.Item value={p.id} dragListener={false} dragControls={controls} onDragStart={p.onDragStart} onDragEnd={p.onDragEnd} className="group relative rounded-xl bg-[var(--bg)]" whileDrag={{ scale: 1.02 }}>
      {p.children(handle)}
    </Reorder.Item>
  );
}

function ChecklistBody({ list }: { list: ListView }) {
  const open = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);
  const [showDone, setShowDone] = useState(false);
  const tick = (i: ItemView) => void setDone(list.id, i.id, !i.done).catch(() => toast("Couldn't change it."));

  return (
    <div>
      <AddRow placeholder="Add an item" onAdd={(text) => addItem(list.id, { text })} />
      {open.length === 0 && <p className="px-2 py-3 text-[14px] text-[var(--text-3)]">{done.length ? "All done." : "Nothing on it yet."}</p>}
      <Sortable
        list={list}
        items={open}
        testId="open-items"
        row={(i, handle) => (
          <div className="flex items-center gap-1.5 py-0.5 pr-1">
            {handle}
            <Tick on={false} label={i.text} onToggle={() => tick(i)} />
            <span className="w-1" />
            <ItemText list={list} item={i} />
            <RemoveButton list={list} item={i} />
          </div>
        )}
      />
      {done.length > 0 && (
        <div className="mt-3 border-t border-[var(--edge)] pt-2">
          <button onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="press inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-medium text-[var(--text-2)]">
            <ChevronDown size={14} aria-hidden className="transition-transform duration-200" style={{ transform: showDone ? undefined : "rotate(-90deg)" }} />
            Done ({done.length})
          </button>
          {showDone && (
            <ul data-testid="done-items" className="flex flex-col">
              {done.map((i) => (
                <li key={i.id} className="group flex items-center gap-1.5 py-0.5 pl-8 pr-1">
                  <Tick on label={i.text} onToggle={() => tick(i)} />
                  <span className="w-1" />
                  <ItemText list={list} item={i} done />
                  <RemoveButton list={list} item={i} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HabitsBody({ list }: { list: ListView }) {
  const days = list.days ?? [];
  const now = today(list);
  const toggle = (i: ItemView, day: string) => void checkInDay(list.id, i.id, day, !i.checkins?.includes(day)).catch(() => toast("Couldn't change it."));
  return (
    <div>
      <AddRow placeholder="Add a habit" onAdd={(text) => addItem(list.id, { text })} />
      {list.items.length === 0 && <p className="px-2 py-3 text-[14px] text-[var(--text-3)]">No habits yet.</p>}
      {list.items.length > 0 && (
        // Day names over the boxes: on the right on wide screens, under the name on phones.
        <div data-testid="habit-days" aria-hidden className="mb-1 flex gap-1 pl-9 text-center text-[11px] text-[var(--text-3)] sm:justify-end sm:pl-0 sm:pr-9">
          {days.map((d) => (
            <span key={d} className={`w-8 ${d === now ? "font-semibold text-[var(--text)]" : ""}`}>
              {DateTime.fromISO(d).toFormat("ccccc")}
              <br />
              {DateTime.fromISO(d).toFormat("d")}
            </span>
          ))}
        </div>
      )}
      <Sortable
        list={list}
        items={list.items}
        testId="habits"
        row={(i, handle) => (
          <div className="flex flex-col gap-1 py-1.5 pr-1 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {handle}
              <div className="min-w-0 flex-1">
                <ItemText list={list} item={i} />
                <div data-testid="streak" className="tnum -mt-0.5 text-[12px] text-[var(--text-3)]">
                  {streakText(i)}
                </div>
              </div>
              <span className="sm:hidden">
                <RemoveButton list={list} item={i} />
              </span>
            </div>
            <div className="flex items-center gap-1 pl-9 sm:pl-0">
              {days.map((d) => (
                <span key={d} className="grid w-8 place-items-center">
                  <Tick on={!!i.checkins?.includes(d)} label={`${i.text}, ${dayLabel(d, now)}`} onToggle={() => toggle(i, d)} size={d === now ? 26 : 22} />
                </span>
              ))}
              <span className="hidden sm:inline">
                <RemoveButton list={list} item={i} />
              </span>
            </div>
          </div>
        )}
      />
    </div>
  );
}

function ExpensesBody({ list }: { list: ListView }) {
  const locale = typeof navigator === "undefined" ? undefined : navigator.language;
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(() => DateTime.now().toISODate()!);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const hundredths = parseAmount(amount);
    if (!text.trim() || hundredths === null || busy) {
      if (text.trim() && hundredths === null) toast("Type the amount as a number, like 250 or 99.50.");
      return;
    }
    setBusy(true);
    try {
      await addItem(list.id, { text: text.trim(), amount: hundredths, spentOn: day });
      setText("");
      setAmount("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add that.");
    } finally {
      setBusy(false);
    }
  };
  const field = "field h-11 rounded-2xl bg-[var(--surface)] px-3 text-[15px] outline-none edge";
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[var(--surface)] p-3 edge">
          <div className="text-[12px] text-[var(--text-2)]">This month</div>
          <div data-testid="month-total" className="tnum mt-0.5 truncate text-[22px] font-semibold">
            {formatAmount(list.month ?? 0, list.currency, locale)}
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--surface)] p-3 edge">
          <div className="text-[12px] text-[var(--text-2)]">All time</div>
          <div className="tnum mt-0.5 truncate text-[22px] font-semibold">{formatAmount(list.total ?? 0, list.currency, locale)}</div>
        </div>
      </div>
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input aria-label="What for" placeholder="What for" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} className={`${field} min-w-0 flex-[2_1_160px]`} />
        <input aria-label="Amount" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} tnum min-w-0 flex-[1_1_90px]`} />
        <input aria-label="Day" type="date" value={day} max={DateTime.now().toISODate()!} onChange={(e) => e.target.value && setDay(e.target.value)} className={`${field} flex-[1_1_130px]`} />
        <button type="submit" disabled={busy} className="press h-11 rounded-2xl px-4 text-[14px] font-semibold" style={{ background: "var(--bot)", color: "var(--bot-ink)" }}>
          Add
        </button>
      </form>
      {list.items.length === 0 && <p className="px-2 py-3 text-[14px] text-[var(--text-3)]">Nothing logged yet.</p>}
      <ul className="flex flex-col">
        {list.items.map((i) => (
          <li key={i.id} className="group flex items-center gap-2 border-b border-[var(--edge)] py-1.5 pl-2 pr-1 last:border-b-0">
            <ItemText list={list} item={i} />
            <span className="tnum shrink-0 text-[12.5px] text-[var(--text-3)]">{i.spentOn ? DateTime.fromISO(i.spentOn).toFormat("d LLL") : ""}</span>
            <span data-testid="amount" className="tnum min-w-20 shrink-0 text-right text-[15px] font-medium">{formatAmount(i.amount ?? 0, list.currency, locale)}</span>
            <RemoveButton list={list} item={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}
