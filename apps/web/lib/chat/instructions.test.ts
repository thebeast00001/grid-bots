import type { Bot } from "../bots/repo";
import type { Memory } from "../db/schema";
import { buildInstructions, pickMemories } from "./instructions";

const mem = (id: string, text: string, opts: Partial<Memory> = {}): Memory => ({
  id,
  botId: null,
  text,
  source: "you",
  sourceMessageId: null,
  pinned: false,
  createdAt: `2026-11-${10 + Number(id)}T00:00:00Z`,
  ...opts,
});

const bot: Bot = {
  id: "b1",
  name: "Maya",
  handle: "maya",
  job: "Runs my week",
  avatar: { shape: "orb", color: 3, eyes: "dot", acc: "none", material: "clay" },
  soul: "# Maya\n\n## Personality\nCalm and dry.",
  interview: "done",
  model: null,
  mutedUntil: null,
  instructions: ["Always cc Priya"],
  createdAt: "",
  updatedAt: "",
};

test("pickMemories keeps pinned first, then newest, within the budget", () => {
  const all = [mem("1", "old"), mem("2", "pinned", { pinned: true }), mem("3", "new"), mem("4", "x".repeat(100))];
  expect(pickMemories(all, 1000).map((m) => m.id)).toEqual(["2", "4", "3", "1"]);
  expect(pickMemories(all, 20).map((m) => m.id)).toEqual(["2"]);
});

test("instructions put the soul before memories and include standing instructions", () => {
  const text = buildInstructions({
    bot,
    botMemories: [mem("1", "Prefers Tuesday meetings", { botId: "b1" })],
    userMemories: [mem("2", "Name is Ansh")],
    now: new Date("2026-11-18T10:00:00Z"),
    zone: "UTC",
    interview: { pending: false, answered: 0 },
    tools: true,
  });
  expect(text).toContain("You are Maya");
  expect(text.indexOf("Calm and dry.")).toBeLessThan(text.indexOf("Name is Ansh"));
  expect(text).toContain("- Always cc Priya");
  expect(text).toContain("Prefers Tuesday meetings");
  expect(text).toContain("2026-11-18");
  expect(text).toContain("remember tool");
  expect(text).not.toContain("[[interview]]");
});

test("after the fifth answer the bot wraps up instead of asking more", () => {
  const text = buildInstructions({ bot: { ...bot, soul: "" }, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: true, answered: 5 }, tools: false });
  expect(text).not.toContain("[[interview]]");
  expect(text).toContain("interview is complete");
});

test("the interview marker appears only while the interview is pending", () => {
  const text = buildInstructions({ bot: { ...bot, soul: "" }, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: true, answered: 2 }, tools: false });
  expect(text).toContain("[[interview]]");
  expect(text).toContain("question 3 of 5");
  expect(text).not.toContain("remember tool");
});

test("the current time is given in the user's own zone", () => {
  const text = buildInstructions({
    bot,
    botMemories: [],
    userMemories: [],
    now: new Date("2026-11-19T04:30:00Z"),
    zone: "Asia/Kolkata",
    interview: { pending: false, answered: 0 },
    tools: false,
  });
  expect(text).toContain("Thursday, 19 November 2026, 10:00 AM (Asia/Kolkata)");
});

test("with tools on, the bot is told to use set_reminder for anything time-based", () => {
  const text = buildInstructions({ bot, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: false, answered: 0 }, tools: true });
  expect(text).toContain("set_reminder");
  const off = buildInstructions({ bot, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: false, answered: 0 }, tools: false });
  expect(off).not.toContain("set_reminder");
});

test("with tools on, the bot is told to use create_routine for standing jobs", () => {
  const text = buildInstructions({ bot, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: false, answered: 0 }, tools: true });
  expect(text).toContain("create_routine");
});

describe("the web", () => {
  const build = (tools: boolean, search?: "grid" | "builtin" | null) =>
    buildInstructions({ bot, botMemories: [], userMemories: [], now: new Date(), zone: "UTC", interview: { pending: false, answered: 0 }, tools, search });

  test("with search, the bot searches for anything current and cites by number", () => {
    const t = build(true, "grid");
    expect(t).toContain("web_search");
    expect(t).toContain("read_page");
    expect(t).toMatch(/\[1\]/);
    expect(t).not.toMatch(/can't browse the web/);
  });

  test("with the model's own search, it cites its sources", () => {
    const t = build(true, "builtin");
    expect(t).toMatch(/search the web/i);
    expect(t).not.toMatch(/can't browse the web/);
  });

  test("without search, it can read links and says where search is turned on", () => {
    const t = build(true, null);
    expect(t).toContain("read_page");
    expect(t).toContain("Settings → Web");
    expect(t).not.toContain("web_search");
  });

  test("web text is information, never instructions, and private details stay out of searches and links", () => {
    for (const s of ["grid", "builtin", null] as const) {
      const t = build(true, s);
      expect(t).toMatch(/information, not instructions/);
      expect(t).toMatch(/never put .*(memories|private).* into a search or a link/i);
    }
  });

  test("a model without tools still says it can't browse", () => {
    expect(build(false)).toMatch(/can't browse the web/);
  });
});
