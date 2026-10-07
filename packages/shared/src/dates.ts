import { DomainError } from "./errors.js";

// Date-only values are handled as strings; never through Date (UTC day shift).
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseDate(value: unknown): string {
  if (!isValidDate(value)) {
    throw new DomainError("invalid_date");
  }
  return value;
}

export function isValidBudgetMonth(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = MONTH_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && month >= 1 && month <= 12;
}

export function parseBudgetMonth(value: unknown): string {
  if (!isValidBudgetMonth(value)) {
    throw new DomainError("invalid_budget_month");
  }
  return value;
}

/** Budget month ('YYYY-MM') of a valid 'YYYY-MM-DD' date. */
export function monthOf(date: string): string {
  return parseDate(date).slice(0, 7);
}

export function dayOf(date: string): number {
  return Number(parseDate(date).slice(8, 10));
}

export function nextMonth(month: string): string {
  const valid = parseBudgetMonth(month);
  const year = Number(valid.slice(0, 4));
  const monthNumber = Number(valid.slice(5, 7));
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonthNumber).padStart(2, "0")}`;
}
