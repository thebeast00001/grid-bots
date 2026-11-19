"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ApiError, api } from "@/lib/api-client";
import type { ItemView, ListKind, ListView } from "@/lib/client-types";

/**
 * Lists as the server has them: the overview, and each list that's on screen (a chat card,
 * the list page). Changes show at once and are then confirmed by the server; a `lists` event
 * (any tab, any bot) refreshes everything that's loaded. Changes to a list go to the server one
 * at a time, in the order they were made (a reorder must not overtake the tick before it), and
 * the list is read back only once they're all in; an answer that left before a newer change is
 * dropped, so it can't undo that change.
 */

export type Entry = ListView | "gone";

const lists = new Map<string, Entry>();
let overview: ListView[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const gen = new Map<string, number>();
const bump = (key: string) => gen.set(key, (gen.get(key) ?? 0) + 1);
const OVERVIEW = " overview";
/** Per list: the last change sent, and how many are still to finish. */
const queues = new Map<string, Promise<unknown>>();
const pending = new Map<string, number>();

async function fetchList(id: string): Promise<void> {
  for (;;) {
    if ((pending.get(id) ?? 0) > 0) return; // read back once the changes are in
    const g = gen.get(id) ?? 0;
    let next: Entry;
    try {
      next = await api<ListView>(`/api/lists/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) next = "gone";
      else throw e;
    }
    if ((pending.get(id) ?? 0) > 0) return;
    if ((gen.get(id) ?? 0) !== g) continue;
    lists.set(id, next);
    emit();
    return;
  }
}

export const refreshList = fetchList;
export const getListForTests = (id: string) => lists.get(id);

export async function refreshOverview(): Promise<void> {
  for (;;) {
    const g = gen.get(OVERVIEW) ?? 0;
    const r = await api<{ lists: ListView[] }>("/api/lists");
    if ((gen.get(OVERVIEW) ?? 0) !== g) continue;
    overview = r.lists;
    emit();
    return;
  }
}

/** A list changed somewhere: read it again if it's on screen, and the overview if that is. Without an id, everything loaded. */
export function refreshAllLists(listId?: string): void {
  for (const id of listId ? [listId] : lists.keys()) if (lists.has(id)) void fetchList(id).catch(() => {});
  if (overview) void refreshOverview().catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useList(id: string): Entry | null {
  const v = useSyncExternalStore(
    subscribe,
    () => lists.get(id) ?? null,
    () => null,
  );
  useEffect(() => {
    if (!lists.has(id)) fetchList(id).catch(() => {});
  }, [id]);
  return v;
}

export function useLists(): ListView[] | null {
  const v = useSyncExternalStore(
    subscribe,
    () => overview,
    () => null,
  );
  useEffect(() => {
    refreshOverview().catch(() => {});
  }, []);
  return v;
}

/** Shows a change at once; the server's answer (and its event) then settles it. */
function local(id: string, change: (v: ListView) => ListView) {
  const v = lists.get(id);
  bump(id);
  bump(OVERVIEW);
  if (v && v !== "gone") {
    lists.set(id, change(v));
    emit();
  }
}

/** Sends a change after the ones before it; reads the list back when none are left. */
function settle(id: string, send: () => Promise<unknown>): Promise<void> {
  pending.set(id, (pending.get(id) ?? 0) + 1);
  const run = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(send);
  queues.set(id, run);
  return run
    .then(() => undefined)
    .finally(async () => {
      const left = (pending.get(id) ?? 1) - 1;
      pending.set(id, left);
      if (left === 0) await fetchList(id).catch(() => {});
    });
}

const counts = (v: ListView, items: ItemView[]): ListView => {
  if (v.kind !== "checklist") return { ...v, items };
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  return { ...v, items: [...open, ...done], open: open.length, done: done.length };
};

export function setDone(listId: string, itemId: string, done: boolean) {
  local(listId, (v) => counts(v, v.items.map((i) => (i.id === itemId ? { ...i, done, doneAt: done ? new Date().toISOString() : null } : i))));
  return settle(listId, () => api(`/api/lists/${listId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ done }) }));
}

export function checkInDay(listId: string, itemId: string, day: string, on: boolean) {
  local(listId, (v) => ({
    ...v,
    items: v.items.map((i) => (i.id === itemId ? { ...i, checkins: on ? [...(i.checkins ?? []), day] : (i.checkins ?? []).filter((d) => d !== day) } : i)),
  }));
  return settle(listId, () => api(`/api/lists/${listId}/checkins`, { method: "POST", body: JSON.stringify({ itemId, day, on }) }));
}

export async function addItem(listId: string, item: { text: string; amount?: number; spentOn?: string }) {
  bump(listId);
  await settle(listId, () => api(`/api/lists/${listId}/items`, { method: "POST", body: JSON.stringify({ items: [item] }) }));
}

export function editItem(listId: string, itemId: string, patch: { text?: string; amount?: number }) {
  local(listId, (v) => ({ ...v, items: v.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  return settle(listId, () => api(`/api/lists/${listId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(patch) }));
}

export function removeItem(listId: string, itemId: string) {
  local(listId, (v) => counts(v, v.items.filter((i) => i.id !== itemId)));
  return settle(listId, () => api(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" }));
}

/** New order for the open items (all of them, for habits). */
export function reorderItems(listId: string, ids: string[]) {
  local(listId, (v) => {
    const byId = new Map(v.items.map((i) => [i.id, i]));
    const moved = ids.map((id) => byId.get(id)!).filter(Boolean);
    return { ...v, items: [...moved, ...v.items.filter((i) => !ids.includes(i.id))] };
  });
  return settle(listId, () => api(`/api/lists/${listId}/items`, { method: "PUT", body: JSON.stringify({ ids }) }));
}

export function renameList(listId: string, name: string) {
  local(listId, (v) => ({ ...v, name }));
  return settle(listId, () => api(`/api/lists/${listId}`, { method: "PATCH", body: JSON.stringify({ name }) }));
}

export async function createList(name: string, kind: ListKind): Promise<ListView> {
  const v = await api<ListView>("/api/lists", { method: "POST", body: JSON.stringify({ name, kind }) });
  lists.set(v.id, v);
  bump(OVERVIEW);
  emit();
  return v;
}

export async function deleteList(listId: string): Promise<void> {
  await api(`/api/lists/${listId}`, { method: "DELETE" });
  lists.set(listId, "gone");
  bump(OVERVIEW);
  if (overview) overview = overview.filter((l) => l.id !== listId);
  emit();
}
