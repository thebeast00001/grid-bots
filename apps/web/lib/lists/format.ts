import { DateTime } from "luxon";
import type { ListView } from "../client-types";

/** Amounts are kept in hundredths. With a currency they show as money; without, as a plain number. */
export function formatAmount(hundredths: number, currency: string | null, locale?: string): string {
  const value = hundredths / 100;
  if (currency) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
    } catch {
      // An unknown code: fall through to a plain number.
    }
  }
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** "₹ 1,234.50" → 123450 hundredths; null if it isn't a positive amount. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

const shortDay = (iso: string, locale?: string) => DateTime.fromISO(iso).setLocale(locale ?? "en-GB").toFormat("d LLL");

/** The list as plain text, to paste into a message. */
export function shareText(v: ListView, locale?: string): string {
  const lines = [v.name];
  if (v.kind === "checklist") {
    for (const i of v.items.filter((x) => !x.done)) lines.push(`☐ ${i.text}`);
    for (const i of v.items.filter((x) => x.done)) lines.push(`☑ ${i.text}`);
  } else if (v.kind === "habits") {
    for (const i of v.items) lines.push(`${i.text} — ${i.streak ? `${i.streak}-day streak` : "no streak yet"}`);
  } else {
    for (const i of v.items) lines.push(`${i.text} — ${formatAmount(i.amount ?? 0, v.currency, locale)}${i.spentOn ? ` (${shortDay(i.spentOn, "en-GB")})` : ""}`);
    lines.push(`Total: ${formatAmount(v.total ?? 0, v.currency, locale)}`);
  }
  return lines.join("\n");
}
