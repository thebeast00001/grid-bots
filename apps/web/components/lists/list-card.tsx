"use client";

import Link from "next/link";
import { ArrowUpRight, ListChecks } from "lucide-react";
import { DateTime } from "luxon";
import { toast } from "sonner";
import type { ItemView, ListView } from "@/lib/client-types";
import { formatAmount } from "@/lib/lists/format";
import { KindIcon, Tick, streakText, summaryOf, today } from "./list-parts";
import { checkInDay, setDone, useList } from "./lists-store";

const ROWS = 8;
const shell = "mt-1.5 w-[min(360px,80vw)] rounded-[20px] p-3 edge";

/** A list in the chat, as it is now (not as it was when the bot wrote): tick it right here. */
export function ListCard({ id }: { id: string }) {
  const entry = useList(id);
  if (entry === null) return <div data-testid="list-card" aria-busy className={`${shell} h-[92px] bg-[var(--surface)]`} />;
  if (entry === "gone") {
    return (
      <div data-testid="list-card" className={`${shell} flex items-center gap-2 bg-[var(--surface)] text-[13px] text-[var(--text-3)]`}>
        <ListChecks size={15} aria-hidden /> This list was deleted.
      </div>
    );
  }
  const list = entry;
  const locale = typeof navigator === "undefined" ? undefined : navigator.language;
  const rows = list.kind === "expenses" ? list.items.slice(0, 3) : list.items.slice(0, ROWS);
  const more = list.items.length - rows.length;

  return (
    <div data-testid="list-card" className={shell} style={{ background: "var(--bot-soft)" }}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[var(--text-2)]">
          <KindIcon kind={list.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold leading-snug">{list.name}</div>
          <div className="tnum text-[12.5px] text-[var(--text-2)]">{summaryOf(list, locale)}</div>
        </div>
        <Link href={`/lists/${list.id}`} aria-label={`Open ${list.name}`} className="press inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[12.5px] font-medium text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
          Open <ArrowUpRight size={13} />
        </Link>
      </div>

      {list.kind === "expenses" ? (
        <div className="mt-2">
          <div data-testid="month-total" className="tnum text-[20px] font-semibold">
            {formatAmount(list.month ?? 0, list.currency, locale)}
          </div>
          <ul className="mt-1 flex flex-col">
            {rows.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-0.5 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate">{i.text}</span>
                <span className="tnum shrink-0 text-[12px] text-[var(--text-3)]">{i.spentOn ? DateTime.fromISO(i.spentOn).toFormat("d LLL") : ""}</span>
                <span className="tnum shrink-0 font-medium">{formatAmount(i.amount ?? 0, list.currency, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {rows.map((i) => (list.kind === "habits" ? <HabitRow key={i.id} list={list} item={i} /> : <CheckRow key={i.id} list={list} item={i} />))}
        </ul>
      )}
      {more > 0 && (
        <Link href={`/lists/${list.id}`} className="mt-1.5 inline-block text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)]">
          +{more} more
        </Link>
      )}
    </div>
  );
}

function CheckRow({ list, item }: { list: ListView; item: ItemView }) {
  return (
    <li className="flex items-center gap-2 py-0.5">
      <Tick on={item.done} label={item.text} size={20} onToggle={() => void setDone(list.id, item.id, !item.done).catch(() => toast("Couldn't change it."))} />
      <span className={`min-w-0 flex-1 truncate text-[14px] ${item.done ? "text-[var(--text-3)] line-through decoration-[var(--text-3)]" : ""}`}>{item.text}</span>
    </li>
  );
}

function HabitRow({ list, item }: { list: ListView; item: ItemView }) {
  const day = today(list);
  const on = !!item.checkins?.includes(day);
  return (
    <li className="flex items-center gap-2 py-0.5">
      <Tick on={on} label={`${item.text}, today`} size={20} onToggle={() => void checkInDay(list.id, item.id, day, !on).catch(() => toast("Couldn't change it."))} />
      <span className="min-w-0 flex-1 truncate text-[14px]">{item.text}</span>
      <span className="tnum shrink-0 text-[12px] text-[var(--text-3)]">{streakText(item)}</span>
    </li>
  );
}
