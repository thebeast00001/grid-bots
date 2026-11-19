import { DateTime } from "luxon";
import { inQuietHours, shouldPing } from "./rules";

const zone = "Asia/Kolkata";
const local = (iso: string, z = zone) => DateTime.fromISO(iso, { zone: z }).toJSDate();
const night = { from: "22:00", to: "07:00" };

describe("inQuietHours", () => {
  test("a window that crosses midnight", () => {
    expect(inQuietHours(local("2026-11-19T23:30"), night, zone)).toBe(true);
    expect(inQuietHours(local("2026-11-20T06:59"), night, zone)).toBe(true);
    expect(inQuietHours(local("2026-11-20T07:00"), night, zone)).toBe(false);
    expect(inQuietHours(local("2026-11-20T12:00"), night, zone)).toBe(false);
    expect(inQuietHours(local("2026-11-19T22:00"), night, zone)).toBe(true);
  });

  test("a window inside one day, none at all, and an empty one", () => {
    const lunch = { from: "13:00", to: "14:00" };
    expect(inQuietHours(local("2026-11-19T13:30"), lunch, zone)).toBe(true);
    expect(inQuietHours(local("2026-11-19T14:00"), lunch, zone)).toBe(false);
    expect(inQuietHours(local("2026-11-19T13:30"), null, zone)).toBe(false);
    expect(inQuietHours(local("2026-11-19T13:30"), { from: "09:00", to: "09:00" }, zone)).toBe(false);
  });

  test("reads the wall clock in the user's zone across a DST change", () => {
    const ny = "America/New_York";
    // Clocks jump from 02:00 to 03:00 on 8 Mar 2026.
    const w = { from: "01:00", to: "03:00" };
    expect(inQuietHours(local("2026-03-08T01:30", ny), w, ny)).toBe(true);
    expect(inQuietHours(local("2026-03-08T03:30", ny), w, ny)).toBe(false);
  });
});

describe("shouldPing", () => {
  const base = { importance: "normal" as const, mutedUntil: null, at: local("2026-11-19T12:00"), quietHours: null, pingFor: "skip-quiet" as const, zone };

  test("a muted bot never pings; a mute that has ended doesn't count", () => {
    expect(shouldPing({ ...base, kind: "reminder", mutedUntil: local("2026-11-19T13:00") })).toEqual({ ping: false, reason: "muted" });
    expect(shouldPing({ ...base, kind: "reminder", mutedUntil: local("2026-11-19T11:00") })).toEqual({ ping: true });
  });

  test("reminders ping even in quiet hours; routines wait", () => {
    const late = { ...base, at: local("2026-11-19T23:00"), quietHours: night };
    expect(shouldPing({ ...late, kind: "reminder" })).toEqual({ ping: true });
    expect(shouldPing({ ...late, kind: "routine" })).toEqual({ ping: false, reason: "quiet-hours" });
  });

  test("a failed routine always pings (outside quiet hours)", () => {
    expect(shouldPing({ ...base, kind: "routine-failed", importance: "low", pingFor: "important" })).toEqual({ ping: true });
  });

  test("importance against the ping level", () => {
    const r = (importance: "high" | "normal" | "low", pingFor: "all" | "skip-quiet" | "important") => shouldPing({ ...base, kind: "routine", importance, pingFor }).ping;
    expect([r("high", "all"), r("normal", "all"), r("low", "all")]).toEqual([true, true, true]);
    expect([r("high", "skip-quiet"), r("normal", "skip-quiet"), r("low", "skip-quiet")]).toEqual([true, true, false]);
    expect([r("high", "important"), r("normal", "important"), r("low", "important")]).toEqual([true, false, false]);
    expect(shouldPing({ ...base, kind: "routine", importance: "low" })).toEqual({ ping: false, reason: "not-important" });
  });
});
