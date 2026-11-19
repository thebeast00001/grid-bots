import { randomBytes } from "node:crypto";
import { and, asc, count, eq, gte, inArray, max, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { ItemView, ListKind, ListView } from "../client-types";
import { getDb } from "../db/client";
import { habitCheckins, listItems, lists, type ListItemRow, type ListRow } from "../db/schema";
import { publish } from "../events";
import { HttpStatus, notFound } from "../http";
import { userZone } from "../settings";

/**
 * The user's lists. Checklists (groceries, packing, to-dos) keep their order and fold done
 * items under the open ones; habits count check-ins per day and streaks; expenses add up,
 * for all time and for this month. Days are the user's days (their time zone).
 */

export const MAX_LISTS = 200;
export const MAX_ITEMS = 300;
export const MAX_NAME = 80;
export const MAX_TEXT = 200;
/** In hundredths: a billion of anything. */
export const MAX_AMOUNT = 1_000_000_000 * 100;
export const LIST_KINDS: readonly ListKind[] = ["checklist", "habits", "expenses"];
const WINDOW = 7;
/** How far back a streak is counted. */
const STREAK_DAYS = 400;

type When = { now?: Date; zone?: string };
export type NewItem = { text: string; amount?: number | null; spentOn?: string | null };

const hex = () => randomBytes(6).toString("hex");
const bad = (message: string) => new HttpStatus(400, "bad-request", message);
const squash = (s: string) => s.trim().replace(/\s+/g, " ");

function cleanName(name: string): string {
  const n = squash(name ?? "");
  if (!n) throw bad("Give the list a name.");
  if (n.length > MAX_NAME) throw bad(`Keep the list name under ${MAX_NAME} characters.`);
  return n;
}

function cleanText(text: string): string {
  const t = squash(text ?? "");
  if (!t) throw bad("An item needs some text.");
  if (t.length > MAX_TEXT) throw bad(`Keep each item under ${MAX_TEXT} characters.`);
  return t;
}

function cleanCurrency(c: string | null | undefined): string | null {
  if (c == null || c.trim() === "") return null;
  const code = c.trim().toUpperCase();
  try {
    if (!/^[A-Z]{3}$/.test(code)) throw new Error();
    new Intl.NumberFormat("en", { style: "currency", currency: code });
  } catch {
    throw bad("Use a 3-letter currency code, like INR or USD.");
  }
  return code;
}

function cleanAmount(a: number | null | undefined): number | null {
  if (a == null) return null;
  if (!Number.isInteger(a) || a < 0 || a > MAX_AMOUNT) throw bad("That amount doesn't look right.");
  return a;
}

export function cleanDay(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !DateTime.fromISO(d).isValid) throw bad("That isn't a real date. Use YYYY-MM-DD.");
  return d;
}

const today = (zone: string, now: Date) => DateTime.fromJSDate(now, { zone }).toISODate()!;
const daysBack = (from: string, n: number) => Array.from({ length: n }, (_, i) => DateTime.fromISO(from).minus({ days: n - 1 - i }).toISODate()!);

async function when(o: When = {}): Promise<{ now: Date; zone: string }> {
  return { now: o.now ?? new Date(), zone: o.zone ?? (await userZone()) };
}

async function row(id: string): Promise<ListRow> {
  const db = await getDb();
  const [r] = await db.select().from(lists).where(eq(lists.id, id));
  if (!r) throw notFound("List");
  return r;
}

async function touch(id: string) {
  const db = await getDb();
  await db.update(lists).set({ updatedAt: new Date().toISOString() }).where(eq(lists.id, id));
  publish({ type: "lists" });
}

const itemView = (r: ListItemRow): ItemView => ({
  id: r.id,
  text: r.text,
  done: r.done,
  doneAt: r.doneAt?.toISOString() ?? null,
  position: r.position,
  amount: r.amount ?? null,
  spentOn: r.spentOn ?? null,
});

function streakOf(checked: Set<string>, todayIso: string): number {
  let day = DateTime.fromISO(todayIso);
  if (!checked.has(todayIso)) day = day.minus({ days: 1 });
  let n = 0;
  while (checked.has(day.toISODate()!)) {
    n++;
    day = day.minus({ days: 1 });
  }
  return n;
}

function base(r: ListRow): Omit<ListView, "items" | "open" | "done"> {
  return { id: r.id, name: r.name, kind: r.kind, botId: r.botId, currency: r.currency, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

export async function getList(id: string, o: When = {}): Promise<ListView> {
  const r = await row(id);
  const { now, zone } = await when(o);
  const db = await getDb();
  const rows = await db.select().from(listItems).where(eq(listItems.listId, id)).orderBy(asc(listItems.position), asc(listItems.createdAt));
  const items = rows.map(itemView);
  const day = today(zone, now);

  if (r.kind === "checklist") {
    const open = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
    return { ...base(r), items: [...open, ...done], open: open.length, done: done.length };
  }

  if (r.kind === "habits") {
    const days = daysBack(day, WINDOW);
    const since = daysBack(day, STREAK_DAYS)[0];
    const checks = items.length
      ? await db
          .select()
          .from(habitCheckins)
          .where(and(inArray(habitCheckins.itemId, items.map((i) => i.id)), gte(habitCheckins.day, since)))
      : [];
    const byItem = new Map<string, Set<string>>();
    for (const c of checks) (byItem.get(c.itemId) ?? byItem.set(c.itemId, new Set()).get(c.itemId)!).add(c.day);
    const withChecks = items.map((i) => {
      const set = byItem.get(i.id) ?? new Set<string>();
      return { ...i, checkins: days.filter((d) => set.has(d)), streak: streakOf(set, day) };
    });
    const doneToday = withChecks.filter((i) => i.checkins.includes(day)).length;
    return { ...base(r), items: withChecks, open: items.length - doneToday, done: doneToday, days };
  }

  const month = day.slice(0, 7);
  const sorted = [...items].sort((a, b) => (b.spentOn ?? "").localeCompare(a.spentOn ?? "") || b.position - a.position);
  const sum = (xs: ItemView[]) => xs.reduce((n, i) => n + (i.amount ?? 0), 0);
  return { ...base(r), items: sorted, open: items.length, done: 0, total: sum(items), month: sum(items.filter((i) => i.spentOn?.startsWith(month))) };
}

/** Every list, newest change first, with its counts and totals but not its items. */
export async function listLists(o: When = {}): Promise<ListView[]> {
  const { now, zone } = await when(o);
  const db = await getDb();
  const rows = await db.select().from(lists).orderBy(sql`${lists.updatedAt} desc`, asc(lists.id));
  if (!rows.length) return [];
  const day = today(zone, now);
  const monthStart = `${day.slice(0, 7)}-01`;
  const agg = await db
    .select({
      listId: listItems.listId,
      n: count(),
      done: sql<number>`count(*) filter (where ${listItems.done})`.mapWith(Number),
      total: sql<number>`coalesce(sum(${listItems.amount}), 0)`.mapWith(Number),
      month: sql<number>`coalesce(sum(${listItems.amount}) filter (where ${listItems.spentOn} >= ${monthStart}), 0)`.mapWith(Number),
    })
    .from(listItems)
    .groupBy(listItems.listId);
  const todays = await db
    .select({ listId: listItems.listId, n: count() })
    .from(habitCheckins)
    .innerJoin(listItems, eq(habitCheckins.itemId, listItems.id))
    .where(eq(habitCheckins.day, day))
    .groupBy(listItems.listId);
  const a = new Map(agg.map((x) => [x.listId, x]));
  const t = new Map(todays.map((x) => [x.listId, x.n]));
  return rows.map((r) => {
    const x = a.get(r.id) ?? { n: 0, done: 0, total: 0, month: 0 };
    if (r.kind === "checklist") return { ...base(r), items: [], open: x.n - x.done, done: x.done };
    if (r.kind === "habits") return { ...base(r), items: [], open: x.n - (t.get(r.id) ?? 0), done: t.get(r.id) ?? 0 };
    return { ...base(r), items: [], open: x.n, done: 0, total: x.total, month: x.month };
  });
}

function prepare(kind: ListKind, items: NewItem[], day: string) {
  return items.map((i) => ({
    text: cleanText(i.text),
    amount: kind === "expenses" ? cleanAmount(i.amount) : null,
    spentOn: kind === "expenses" ? (i.spentOn ? cleanDay(i.spentOn) : day) : null,
  }));
}

export async function createList(input: { name: string; kind: ListKind; botId?: string | null; currency?: string | null; items?: NewItem[] }, o: When = {}): Promise<ListView> {
  if (!LIST_KINDS.includes(input.kind)) throw bad("A list is a checklist, habits or expenses.");
  const name = cleanName(input.name);
  const currency = input.kind === "expenses" ? cleanCurrency(input.currency) : null;
  const items = input.items ?? [];
  if (items.length > MAX_ITEMS) throw bad(`A list holds up to ${MAX_ITEMS} items.`);
  const { now, zone } = await when(o);
  const ready = prepare(input.kind, items, today(zone, now));
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(lists);
  if (n >= MAX_LISTS) throw bad(`You can keep up to ${MAX_LISTS} lists. Delete one you don't need first.`);
  const id = `lst_${hex()}`;
  await db.insert(lists).values({ id, name, kind: input.kind, botId: input.botId ?? null, currency });
  if (ready.length) await db.insert(listItems).values(ready.map((i, position) => ({ id: `itm_${hex()}`, listId: id, position, ...i })));
  publish({ type: "lists" });
  return getList(id, { now, zone });
}

export async function renameList(id: string, name: string): Promise<ListView> {
  const clean = cleanName(name);
  await row(id);
  const db = await getDb();
  await db.update(lists).set({ name: clean }).where(eq(lists.id, id));
  await touch(id);
  return getList(id);
}

export async function deleteList(id: string): Promise<void> {
  await row(id);
  const db = await getDb();
  await db.delete(lists).where(eq(lists.id, id));
  publish({ type: "lists" });
}

export async function addItems(listId: string, items: NewItem[], o: When = {}): Promise<ItemView[]> {
  const r = await row(listId);
  if (!items.length) return [];
  const { now, zone } = await when(o);
  const ready = prepare(r.kind, items, today(zone, now));
  const db = await getDb();
  const [{ n, top }] = await db.select({ n: count(), top: max(listItems.position) }).from(listItems).where(eq(listItems.listId, listId));
  if (n + ready.length > MAX_ITEMS) throw bad(`A list holds up to ${MAX_ITEMS} items.`);
  const start = (top ?? -1) + 1;
  const rows = await db
    .insert(listItems)
    .values(ready.map((i, k) => ({ id: `itm_${hex()}`, listId, position: start + k, ...i })))
    .returning();
  await touch(listId);
  return rows.sort((a, b) => a.position - b.position).map(itemView);
}

async function itemOf(listId: string, itemId: string): Promise<ListItemRow> {
  const db = await getDb();
  const [it] = await db.select().from(listItems).where(and(eq(listItems.id, itemId), eq(listItems.listId, listId)));
  if (!it) throw notFound("Item");
  return it;
}

export async function updateItem(listId: string, itemId: string, patch: { text?: string; done?: boolean; amount?: number | null; spentOn?: string | null }, o: When = {}): Promise<ItemView> {
  const r = await row(listId);
  await itemOf(listId, itemId);
  const set: Partial<ListItemRow> = {};
  if (patch.text !== undefined) set.text = cleanText(patch.text);
  if (patch.done !== undefined && r.kind === "checklist") {
    set.done = patch.done;
    set.doneAt = patch.done ? (o.now ?? new Date()) : null;
  }
  if (r.kind === "expenses") {
    if (patch.amount !== undefined) set.amount = cleanAmount(patch.amount);
    if (patch.spentOn) set.spentOn = cleanDay(patch.spentOn);
  }
  const db = await getDb();
  if (Object.keys(set).length) await db.update(listItems).set(set).where(eq(listItems.id, itemId));
  await touch(listId);
  return itemView(await itemOf(listId, itemId));
}

export async function removeItems(listId: string, ids: string[]): Promise<number> {
  await row(listId);
  if (!ids.length) return 0;
  const db = await getDb();
  const gone = await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), inArray(listItems.id, ids)))
    .returning({ id: listItems.id });
  await touch(listId);
  return gone.length;
}

/** New order for the open items of a checklist, or for all of a habit list. */
export async function reorder(listId: string, ids: string[]): Promise<void> {
  const r = await row(listId);
  if (r.kind === "expenses") throw bad("Expenses are kept in date order.");
  const db = await getDb();
  const all = await db.select().from(listItems).where(eq(listItems.listId, listId));
  const movable = all.filter((i) => r.kind === "habits" || !i.done).map((i) => i.id);
  if (ids.length !== movable.length || new Set(ids).size !== ids.length || !ids.every((id) => movable.includes(id))) {
    throw bad("Reorder needs every open item, once each.");
  }
  for (const [position, id] of ids.entries()) await db.update(listItems).set({ position }).where(eq(listItems.id, id));
  await touch(listId);
}

/** Marks a habit done (or not) on a day. */
export async function checkIn(listId: string, itemId: string, day: string, on: boolean, o: When = {}): Promise<void> {
  const r = await row(listId);
  if (r.kind !== "habits") throw bad("Only habit lists have check-ins.");
  await itemOf(listId, itemId);
  const d = cleanDay(day);
  const { now, zone } = await when(o);
  if (d > today(zone, now)) throw bad("That day is in the future.");
  const db = await getDb();
  if (on) await db.insert(habitCheckins).values({ itemId, day: d }).onConflictDoNothing();
  else await db.delete(habitCheckins).where(and(eq(habitCheckins.itemId, itemId), eq(habitCheckins.day, d)));
  await touch(listId);
}

export { today as todayIn };
