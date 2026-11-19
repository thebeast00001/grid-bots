import { timeBreaks } from "./time-breaks";

const m = (id: string, at?: string) => ({ id, metadata: at ? { at } : undefined });
const opts = { now: new Date("2026-11-20T10:00:00Z"), locale: "en-US", zone: "UTC" };

test("a time over the first message, and again after 15 quiet minutes", () => {
  const b = timeBreaks([m("a", "2026-11-20T09:00:00Z"), m("b", "2026-11-20T09:10:00Z"), m("c", "2026-11-20T09:25:00Z"), m("d", "2026-11-20T09:26:00Z")], opts);
  expect([...b.entries()]).toEqual([
    ["a", "9:00 AM"],
    ["c", "9:25 AM"],
  ]);
});

test("other days say which day", () => {
  const b = timeBreaks([m("a", "2026-11-10T09:00:00Z"), m("b", "2026-11-17T21:00:00Z"), m("c", "2026-11-19T21:00:00Z")], opts);
  expect([...b.values()]).toEqual(["10 Nov, 9:00 AM", "Tue 9:00 PM", "Yesterday 9:00 PM"]);
});

test("messages without a time (just sent) get none", () => {
  expect(timeBreaks([m("a"), m("b")], opts).size).toBe(0);
  expect([...timeBreaks([m("a", "2026-11-20T09:00:00Z"), m("b")], opts).keys()]).toEqual(["a"]);
});
