import type { ListView } from "../client-types";
import { formatAmount, parseAmount, shareText } from "./format";

const base = { id: "l", botId: null, currency: null, createdAt: "", updatedAt: "", open: 0, done: 0 };
const item = (o: Partial<ListView["items"][number]>) => ({ id: Math.random().toString(), text: "", done: false, doneAt: null, position: 0, amount: null, spentOn: null, ...o });

test("amounts: hundredths, with the list's currency or plain", () => {
  expect(formatAmount(25_000, "INR", "en-US")).toBe("₹250.00");
  expect(formatAmount(25_000, null, "en-US")).toBe("250.00");
  expect(formatAmount(123_456_789, null, "en-US")).toBe("1,234,567.89");
  expect(formatAmount(50_000, "JPY", "en-US")).toBe("¥500");
});

test("typed amounts become hundredths", () => {
  expect(parseAmount("250")).toBe(25_000);
  expect(parseAmount("1,234.5")).toBe(123_450);
  expect(parseAmount("₹ 99.99")).toBe(9_999);
  expect(parseAmount("abc")).toBeNull();
  expect(parseAmount("-5")).toBeNull();
});

test("a checklist as text: open first, then done", () => {
  const v: ListView = { ...base, name: "Groceries", kind: "checklist", items: [item({ text: "milk" }), item({ text: "bread", done: true }), item({ text: "eggs" })] };
  expect(shareText(v, "en-US")).toBe("Groceries\n☐ milk\n☐ eggs\n☑ bread");
});

test("habits as text: each with its streak", () => {
  const v: ListView = { ...base, name: "Habits", kind: "habits", items: [item({ text: "Run", streak: 5 }), item({ text: "Read", streak: 1 }), item({ text: "Floss", streak: 0 })] };
  expect(shareText(v, "en-US")).toBe("Habits\nRun — 5-day streak\nRead — 1-day streak\nFloss — no streak yet");
});

test("expenses as text: amount and day for each, then the total", () => {
  const v: ListView = {
    ...base,
    name: "Trip",
    kind: "expenses",
    currency: "INR",
    total: 27_500,
    items: [item({ text: "Lunch", amount: 25_000, spentOn: "2026-11-19" }), item({ text: "Tea", amount: 2_500, spentOn: "2026-11-18" })],
  };
  expect(shareText(v, "en-US")).toBe("Trip\nLunch — ₹250.00 (19 Nov)\nTea — ₹25.00 (18 Nov)\nTotal: ₹275.00");
});
