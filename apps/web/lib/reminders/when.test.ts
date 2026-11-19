import { DateTime } from "luxon";
import { formatWhen, nextOccurrence, parseRepeat, parseWhen, repeatLabel, snoozeUntil } from "./when";

const zone = "Asia/Kolkata";
const local = (iso: string, z = zone) => DateTime.fromISO(iso, { zone: z }).toJSDate();
// Thursday 19 Nov 2026, 10:00 in Kolkata.
const now = local("2026-11-19T10:00");
const at = (iso: string) => ({ now: local(iso), zone });

describe("parseWhen", () => {
  test("a day and a time", () => {
    expect(parseWhen("tomorrow at 9am", { now, zone })).toEqual({ at: local("2026-11-20T09:00"), timeGuessed: false });
  });

  test("a day alone means 9 AM", () => {
    expect(parseWhen("friday", { now, zone })).toEqual({ at: local("2026-11-20T09:00"), timeGuessed: true });
  });

  test("an hour without AM/PM is its next future occurrence", () => {
    expect(parseWhen("at 6", { now, zone })).toMatchObject({ at: local("2026-11-19T18:00") });
    expect(parseWhen("at 6", at("2026-11-19T19:00"))).toMatchObject({ at: local("2026-11-20T06:00") });
  });

  test("relative times count from now", () => {
    expect(parseWhen("in 3 seconds", { now, zone })).toMatchObject({ at: new Date(now.getTime() + 3_000) });
    expect(parseWhen("in 2 hours", { now, zone })).toMatchObject({ at: new Date(now.getTime() + 2 * 3_600_000) });
  });

  test("a time that has passed is refused, nonsense is unclear", () => {
    expect(parseWhen("today 6pm", at("2026-11-19T19:00"))).toEqual({ error: "past" });
    expect(parseWhen("purple", { now, zone })).toEqual({ error: "unclear" });
    expect(parseWhen("", { now, zone })).toEqual({ error: "unclear" });
  });

  test("wall-clock times are read in the user's zone across a DST change", () => {
    // New York moves its clocks on Sunday 8 Mar 2026; "9am" that day is 13:00Z, not 14:00Z.
    const ny = { now: local("2026-03-07T12:00", "America/New_York"), zone: "America/New_York" };
    expect(parseWhen("tomorrow at 9am", ny)).toMatchObject({ at: new Date("2026-03-08T13:00:00Z") });
  });
});

describe("parseRepeat", () => {
  test("reads common repeat phrases", () => {
    expect(parseRepeat("every day at 9")).toBe("daily");
    expect(parseRepeat("daily")).toBe("daily");
    expect(parseRepeat("every weekday at 8am")).toBe("weekdays");
    expect(parseRepeat("every friday 6pm")).toBe("weekly");
    expect(parseRepeat("every week")).toBe("weekly");
    expect(parseRepeat("every month on the 1st")).toBe("monthly");
    expect(parseRepeat("monthly")).toBe("monthly");
    expect(parseRepeat("every year on 14 feb")).toBe("yearly");
    expect(parseRepeat("friday 6pm")).toBeNull();
  });
});

describe("nextOccurrence", () => {
  test("monthly from the 31st clamps to short months without drifting", () => {
    const anchor = local("2027-01-31T09:00");
    const feb = nextOccurrence(anchor, "monthly", anchor, zone)!;
    expect(feb).toEqual(local("2027-02-28T09:00"));
    expect(nextOccurrence(anchor, "monthly", feb, zone)).toEqual(local("2027-03-31T09:00"));
  });

  test("yearly from leap day", () => {
    const anchor = local("2028-02-29T09:00");
    expect(nextOccurrence(anchor, "yearly", anchor, zone)).toEqual(local("2029-02-28T09:00"));
  });

  test("weekdays skip the weekend", () => {
    const friday = local("2026-11-20T18:00");
    expect(nextOccurrence(friday, "weekdays", friday, zone)).toEqual(local("2026-11-23T18:00"));
  });

  test("daily keeps the wall-clock time across DST", () => {
    const anchor = local("2026-03-07T09:00", "America/New_York");
    expect(nextOccurrence(anchor, "daily", anchor, "America/New_York")).toEqual(new Date("2026-03-08T13:00:00Z"));
  });

  test("skips every occurrence up to `after`", () => {
    const anchor = local("2026-11-01T09:00");
    expect(nextOccurrence(anchor, "daily", local("2026-11-19T10:00"), zone)).toEqual(local("2026-11-20T09:00"));
  });

  test("none never repeats", () => {
    expect(nextOccurrence(now, "none", now, zone)).toBeNull();
  });
});

describe("labels", () => {
  test("formatWhen", () => {
    const o = { now, zone };
    expect(formatWhen(local("2026-11-19T18:00"), o)).toBe("Today, 6:00 PM");
    expect(formatWhen(local("2026-11-20T09:00"), o)).toBe("Tomorrow, 9:00 AM");
    expect(formatWhen(local("2026-11-18T18:00"), o)).toBe("Yesterday, 6:00 PM");
    expect(formatWhen(local("2026-11-21T18:00"), o)).toBe("Sat 21 Nov, 6:00 PM");
    expect(formatWhen(local("2027-11-21T09:00"), o)).toBe("21 Nov 2027, 9:00 AM");
  });

  test("repeatLabel", () => {
    expect(repeatLabel("daily", local("2026-11-20T09:00"), zone)).toBe("Every day at 9:00 AM");
    expect(repeatLabel("weekdays", local("2026-11-20T08:00"), zone)).toBe("Weekdays at 8:00 AM");
    expect(repeatLabel("weekly", local("2026-11-20T18:00"), zone)).toBe("Every Friday at 6:00 PM");
    expect(repeatLabel("monthly", local("2026-12-01T09:00"), zone)).toBe("Every month on the 1st at 9:00 AM");
    expect(repeatLabel("monthly", local("2026-12-22T09:00"), zone)).toBe("Every month on the 22nd at 9:00 AM");
    expect(repeatLabel("monthly", local("2026-12-13T09:00"), zone)).toBe("Every month on the 13th at 9:00 AM");
    expect(repeatLabel("yearly", local("2027-02-14T09:00"), zone)).toBe("Every year on 14 Feb at 9:00 AM");
    expect(repeatLabel("none", now, zone)).toBeNull();
  });
});

describe("snoozeUntil", () => {
  test("presets", () => {
    expect(snoozeUntil("10m", { now, zone })).toEqual(new Date(now.getTime() + 600_000));
    expect(snoozeUntil("1h", { now, zone })).toEqual(new Date(now.getTime() + 3_600_000));
    expect(snoozeUntil("evening", { now, zone })).toEqual(local("2026-11-19T18:00"));
    expect(snoozeUntil("evening", at("2026-11-19T17:30"))).toEqual(local("2026-11-19T20:30"));
    expect(snoozeUntil("tomorrow", { now, zone })).toEqual(local("2026-11-20T09:00"));
  });
});
