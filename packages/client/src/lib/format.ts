import type { OperationClass } from "@suivi/shared";

// docs/design-brief.md §5. Date-only values stay strings: never through new Date() + UTC (PROJECT.md §Gotchas).

const amountFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Integer XAF with French grouping, e.g. 1 023 000. */
export function formatAmount(amount: number): string {
  return amountFormat.format(amount);
}

export type AmountTone = "expense" | "income" | "neutral" | "savings";

export interface SignedAmount {
  readonly text: string;
  readonly tone: AmountTone;
}

/** Design brief §3/§5: expenses with a true minus, income with +, transfers without sign. */
export function signedAmount(operationClass: OperationClass, amount: number, isInflow: boolean): SignedAmount {
  const value = formatAmount(amount);
  switch (operationClass) {
    case "revenue":
    case "repayment":
      return { text: `+${value}`, tone: "income" };
    case "transfer":
      return { text: value, tone: "neutral" };
    case "savings":
      return { text: value, tone: "savings" };
    case "project":
      // Projects are paid from savings (R7): money out, in the savings colour.
      return { text: `−${value}`, tone: "savings" };
    case "adjustment":
      return isInflow ? { text: `+${value}`, tone: "income" } : { text: `−${value}`, tone: "expense" };
    default:
      return { text: `−${value}`, tone: "expense" };
  }
}

/** 'YYYY-MM-DD' → 'jj/mm' in the current year, 'jj/mm/aaaa' otherwise. */
export function formatListDate(date: string, currentYear: number): string {
  const [year, month, day] = date.split("-");
  return Number(year) === currentYear ? `${day}/${month}` : `${day}/${month}/${year}`;
}

/** 'YYYY-MM' → 'octobre 2026'. */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1] ?? month} ${year}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's local date as 'YYYY-MM-DD' (local calendar, not UTC). */
export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 'YYYY-MM' shifted by a number of months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = (year ?? 0) * 12 + (monthNumber ?? 1) - 1 + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Digits typed by the user → integer amount, or null when empty or not a positive safe integer. */
export function parseAmountInput(text: string): number | null {
  const digits = text.replace(/[\s  ]/g, "");
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
